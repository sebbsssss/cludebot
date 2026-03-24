import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './index.css'

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
if (!privyAppId) throw new Error('VITE_PRIVY_APP_ID is required');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#2244ff',
          showWalletLoginFirst: true,
          walletList: ['phantom', 'solflare', 'backpack', 'detected_wallets'],
        },
        loginMethods: ['wallet'],
        walletChainType: 'solana-only',
        embeddedWallets: { createOnLogin: 'off' },
        solanaClusters: [{ name: 'mainnet-beta', rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL ?? `${window.location.origin}/api/solana-rpc` }],
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
      } as any}
    >
      <BrowserRouter basename="/chat">
        <App />
      </BrowserRouter>
    </PrivyProvider>
  </StrictMode>,
)
