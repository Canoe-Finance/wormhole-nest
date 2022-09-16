import bs58 from 'bs58';
import { ixFromRust } from '@certusone/wormhole-sdk';
import { importTokenWasm, setDefaultWasm } from '@certusone/wormhole-sdk-wasm';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createApproveInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { arrayify, zeroPad } from 'ethers/lib/utils';
import { AppDto } from './app.dto';
import { connection, SOL_BRIDGE_ADDRESS, SOL_TOKEN_BRIDGE_ADDRESS } from './constants';
import { createNonce, getBridgeFeeIx } from './utils';

@Injectable()
export class AppService {
  async buildTx(data: AppDto) {
    // check payerAddress address
    try {
      const mintPublicKey = new PublicKey(data.mint);
      const isValidAddress = PublicKey.isOnCurve(mintPublicKey);
      if (!isValidAddress) {
        throw new HttpException('Invalid mint', HttpStatus.NOT_ACCEPTABLE);
      }
    } catch (_) {
      throw new HttpException('Invalid mint', HttpStatus.NOT_ACCEPTABLE);
    }

    const fromAddress = await getAssociatedTokenAddress(new PublicKey(data.mint), new PublicKey(data.userPublicKey));

    setDefaultWasm('node');

    const transferIx = await getBridgeFeeIx(data.userPublicKey);

    const nonce = createNonce().readUInt32LE(0);
    const { transfer_native_ix, approval_authority_address } = await importTokenWasm();
    const approvalIx = createApproveInstruction(
      new PublicKey(fromAddress),
      new PublicKey(approval_authority_address(SOL_TOKEN_BRIDGE_ADDRESS)),
      new PublicKey(data.userPublicKey),
      BigInt(data.amount)
    );
    const messageKey = Keypair.generate();

    const targetAddress = zeroPad(arrayify(data.targetAddress), 32);

    const ix = ixFromRust(
      transfer_native_ix(
        SOL_TOKEN_BRIDGE_ADDRESS,
        SOL_BRIDGE_ADDRESS,
        data.userPublicKey,
        messageKey.publicKey.toString(),
        fromAddress.toBase58(),
        data.mint,
        nonce,
        BigInt(data.amount),
        BigInt(0),
        targetAddress,
        2
      )
    );

    const transaction = new Transaction().add(transferIx, approvalIx, ix);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(data.userPublicKey);
    transaction.partialSign(messageKey);

    return transaction.serialize({ verifySignatures: false }).toString('base64');
  }
}
