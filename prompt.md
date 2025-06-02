saya ingin refactor dan optimize code ini menjadi :
flow :

- generate new wallet dan pk disave ke wallets.json (update trus bkn diganti)
- cek eth balance (validasi jika kurng 0.1 maka loop saja jgn dilanjut)
- cek weth balance (0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9) jika lebih = 1 maka lanjut (jika kurang maka dia akan wrap WETH (0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9) dengan func deposit amount 1 ether)
-
