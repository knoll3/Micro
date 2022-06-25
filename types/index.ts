import { BigNumber, Signature } from "ethers";

export interface MicroPayment {
  signature: Signature;
  nonce: string;
  amount: BigNumber;
  sender: string;
}
