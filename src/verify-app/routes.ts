import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import { verifySignature } from '../core/solana-client';
import { linkWallet } from '../features/holder-tier';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('verify-routes');

interface VerifyRequest {
  x_handle: string;
  wallet_address: string;
  signature: string; // base64 encoded
  message: string;
}

export function verifyRoutes(): Router {
  const router = Router();

  router.post('/verify', async (req, res) => {
    try {
      const { x_handle, wallet_address, signature, message } = req.body as VerifyRequest;

      // Validate inputs
      if (!x_handle || !wallet_address || !signature || !message) {
        res.status(400).json({ error: 'Missing required fields: x_handle, wallet_address, signature, message' });
        return;
      }

      // Validate x_handle format
      const cleanHandle = x_handle.replace('@', '').trim();
      if (!/^[a-zA-Z0-9_]{1,15}$/.test(cleanHandle)) {
        res.status(400).json({ error: 'Invalid X handle format' });
        return;
      }

      // Validate wallet address
      let publicKey: PublicKey;
      try {
        publicKey = new PublicKey(wallet_address);
      } catch {
        res.status(400).json({ error: 'Invalid Solana wallet address' });
        return;
      }

      // Verify the message contains the expected format
      if (!message.includes(cleanHandle)) {
        res.status(400).json({ error: 'Message must contain your X handle' });
        return;
      }

      // Verify signature
      const sigBytes = Uint8Array.from(Buffer.from(signature, 'base64'));
      const pubKeyBytes = publicKey.toBytes();

      const isValid = verifySignature(message, sigBytes, pubKeyBytes);
      if (!isValid) {
        log.warn({ x_handle: cleanHandle, wallet: wallet_address }, 'Invalid signature');
        res.status(401).json({ error: 'Invalid signature. Please sign with the correct wallet.' });
        return;
      }

      // Link wallet to X handle
      // Note: x_user_id is set to handle for now; will be resolved on first interaction
      await linkWallet(cleanHandle, cleanHandle, wallet_address);

      log.info({ x_handle: cleanHandle, wallet: wallet_address }, 'Wallet verified and linked');
      res.json({ success: true, message: `Wallet ${wallet_address} linked to @${cleanHandle}` });
    } catch (err) {
      log.error({ err }, 'Verification failed');
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  return router;
}
