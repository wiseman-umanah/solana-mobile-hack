const nacl = require('tweetnacl');
const bs58 = require('bs58');

module.exports = function verifySignature(walletAddress, signatureBase64, message) {
  try {
    const signature = Buffer.from(signatureBase64, 'base64');
    const messageBytes = Buffer.from(message, 'utf8');
    const publicKeyBytes = bs58.decode(walletAddress);

    return nacl.sign.detached.verify(new Uint8Array(messageBytes), new Uint8Array(signature), new Uint8Array(publicKeyBytes));
  } catch (err) {
    console.error('Error verifying signature', err);
    return false;
  }
};
