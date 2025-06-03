class WalletPool {
  constructor(privateKeys, provider, wethAddress) {
    this.wallets = privateKeys.map(pk => ({
      pk,
      busy: false,
      busyForWorker: null,
      lastCheck: 0,
      eth: 0,
      weth: 0,
      recentFail: 0 // timestamp kapan terakhir fatal error
    }));
    this.provider = provider;
    this.wethAddress = wethAddress;
    this._mutex = Promise.resolve();
  }

  async _withLock(fn) {
    let unlockNext;
    const willLock = new Promise(res => unlockNext = res);
    const willWait = this._mutex.then(() => unlockNext);
    this._mutex = willLock;
    try {
      return await fn();
    } finally {
      unlockNext();
    }
  }

  // Blacklist cooldown dalam ms (default 10 menit)
  static COOLDOWN_FAIL_MS = 2 * 60 * 1000;

  // Acquire wallet atomic, skip yang error (recentFail)
  async acquire(workerId, minEth, minWeth) {
    return await this._withLock(async () => {
      await this.updateBalances();
      for (const wallet of this.wallets) {
        // Skip jika masih cooldown error
        if (wallet.recentFail && Date.now() - wallet.recentFail < WalletPool.COOLDOWN_FAIL_MS) continue;
        if (!wallet.busy && wallet.eth >= minEth) {
          wallet.busy = true;
          wallet.busyForWorker = workerId;
          try {
            if (wallet.weth < minWeth) {
              const w = new (require("ethers").Wallet)(wallet.pk, this.provider);
              const wrapWETH = require("./src/wrapWETH");
              const wrapAmount = "0.098";
              await wrapWETH(w, this.wethAddress, wrapAmount);
              await new Promise(res => setTimeout(res, 5000));
              const getBalances = require("./src/getBalances");
              const { weth } = await getBalances(this.provider, w.address, this.wethAddress);
              wallet.weth = parseFloat(weth);
            }
            if (wallet.weth >= minWeth) {
              return wallet.pk;
            } else {
              wallet.busy = false;
              wallet.busyForWorker = null;
              continue;
            }
          } catch (err) {
            wallet.busy = false;
            wallet.busyForWorker = null;
            wallet.recentFail = Date.now(); // Mark error, skip wallet ini sementara
            continue;
          }
        }
      }
      throw new Error("NO_WALLET_READY");
    });
  }

  release(pk) {
    const w = this.wallets.find(w => w.pk === pk);
    if (w) {
      w.busy = false;
      w.busyForWorker = null;
    }
  }

  // Mark wallet error by public address (bisa dipanggil dari luar)
  markRecentFail(address) {
    const target = address.toLowerCase();
    for (const w of this.wallets) {
      try {
        const addr = new (require('ethers').Wallet)(w.pk).address.toLowerCase();
        if (addr === target) {
          w.recentFail = Date.now();
          w.busy = false;
          w.busyForWorker = null;
        }
      } catch {}
    }
  }

  async updateBalances() {
    const getBalances = require("./src/getBalances");
    for (const wallet of this.wallets) {
      const w = new (require("ethers").Wallet)(wallet.pk, this.provider);
      const { eth, weth } = await getBalances(this.provider, w.address, this.wethAddress);
      wallet.eth = parseFloat(eth);
      wallet.weth = parseFloat(weth);
      wallet.lastCheck = Date.now();
      // (Opsional) reset recentFail jika saldo sudah sehat
      if (wallet.eth > 0.01 && wallet.weth > 0.01) wallet.recentFail = 0;
    }
  }

  async acquireEmergencyFee(minEth) {
    await this.updateBalances();
    for (const wallet of this.wallets) {
      if (
        !wallet.busy &&
        wallet.eth >= minEth &&
        (!wallet.recentFail || Date.now() - wallet.recentFail >= WalletPool.COOLDOWN_FAIL_MS)
      ) {
        wallet.busy = true;
        wallet.busyForWorker = "EMERGENCY";
        return wallet.pk;
      }
    }
    return null;
  }
}

module.exports = WalletPool;
