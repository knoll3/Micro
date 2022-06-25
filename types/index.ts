import { BigNumber, Signature } from "ethers";

export interface MicroPayment {
  signature: Signature;
  nonce: BigNumber;
  amount: BigNumber;
  sender: string;
}
