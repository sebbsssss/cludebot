import { Router } from 'express';
import { ethers } from 'ethers';
import { verifySignature } from '../core/base-client';
import { linkWallet } from '../features/holder-tier';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('verify-routes');

interface VerifyRequest {
  x_handle: string;
  wallet_address: string;
  signature: string; // hex encoded
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
      if (!ethers.isAddress(wallet_address)) {
        res.status(400).json({ error: 'Invalid wallet address' });
        return;
      }

      // Verify the message contains the expected format
      if (!message.includes(cleanHandle)) {
        res.status(400).json({ error: 'Message must contain your X handle' });
        return;
      }

      // Verify EIP-191 signature
      const isValid = verifySignature(message, signature, wallet_address);
      if (!isValid) {
        log.warn({ x_handle: cleanHandle, wallet: wallet_address }, 'Invalid signature');
        res.status(401).json({ error: 'Invalid signature. Please sign with the correct wallet.' });
        return;
      }

      // Link wallet to X handle
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
