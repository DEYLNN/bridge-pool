class WalletPool {
    constructor(privateKeys, provider, wethAddress) {
      this.wallets = privateKeys.map(pk => ({
        pk,
        busy: false,
        busyForWorker: null,
        lastCheck: 0,
        eth: 0,
        weth: 0
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
  
    // Synchronized acquire! Auto-wrap if ETH ready but WETH kurang.
    async acquire(workerId, minEth, minWeth) {
      return await this._withLock(async () => {
        await this.updateBalances();
        for (const wallet of this.wallets) {
          if (!wallet.busy && wallet.eth >= minEth) {
            // Jika WETH kurang, auto-wrap!
            if (wallet.weth < minWeth) {
              const w = new (require("ethers").Wallet)(wallet.pk, this.provider);
              const wrapWETH = require("./src/wrapWETH");
              // Cek cukup ETH untuk wrap minWeth (minimal 0.03), wrap minimal selisih yg kurang
              const wrapAmount = "0.098";
              try {
                await wrapWETH(w, this.wethAddress, wrapAmount);
                await new Promise(res => setTimeout(res, 5000));
                // Update saldo setelah wrap
                const getBalances = require("./src/getBalances");
                const { weth } = await getBalances(this.provider, w.address, this.wethAddress);
                wallet.weth = parseFloat(weth);
              } catch (err) {
                // Kalau gagal wrap, skip ke wallet berikutnya
                continue;
              }
            }
            if (wallet.weth >= minWeth) {
              wallet.busy = true;
              wallet.busyForWorker = workerId;
              return wallet.pk;
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
  
    async updateBalances() {
      const getBalances = require("./src/getBalances");
      for (const wallet of this.wallets) {
        const w = new (require("ethers").Wallet)(wallet.pk, this.provider);
        const { eth, weth } = await getBalances(this.provider, w.address, this.wethAddress);
        wallet.eth = parseFloat(eth);
        wallet.weth = parseFloat(weth);
        wallet.lastCheck = Date.now();
      }
    }
  
    async acquireEmergencyFee(minEth) {
      await this.updateBalances();
      for (const wallet of this.wallets) {
        if (!wallet.busy && wallet.eth >= minEth) {
          return wallet.pk;
        }
      }
      return null;
    }
  }
  module.exports = WalletPool;
  