import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { Micro, MicroToken } from "../typechain";
import { generateRandomNonce, sign } from "./helpers";
import { MicroPayment } from "../types";
import { arrayify } from "ethers/lib/utils";

describe("Contract: Micro", function () {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let payers: SignerWithAddress[];
  let microToken: MicroToken;
  let micro: Micro;

  before(async () => {
    signers = await ethers.getSigners();

    owner = signers[0];
    payers = [signers[1], signers[2], signers[3]];

    // Deploy the MicroToken contract
    const MicroToken = await ethers.getContractFactory("MicroToken");
    microToken = await MicroToken.deploy();
    await microToken.deployed();

    // Deploy the Micro contract
    const Micro = await ethers.getContractFactory("Micro");
    micro = await Micro.deploy(owner.address, microToken.address);
    await micro.deployed();

    // Fund the signers
    for (const signer of signers) {
      await microToken
        .connect(signer)
        .approve(micro.address, ethers.constants.MaxUint256);

      await microToken.transfer(signer.address, BigNumber.from("1000"));
    }
  });

  describe("depositTokens()", () => {
    it("should transfer tokens to the contract", async () => {
      const amount = BigNumber.from("100");

      // Get the first payer's balance before deposit
      const balanceBefore = await microToken.balanceOf(payers[0].address);

      // Get the balance of the contract before
      const contractBalanceBefore = await microToken.balanceOf(micro.address);

      await micro.connect(payers[0]).depositTokens(amount);

      // Get the first payer's balance after deposit
      const balanceAfter = await microToken.balanceOf(payers[0].address);

      // Get the balance of the contract after
      const contractBalanceAfter = await microToken.balanceOf(micro.address);

      // Check that the balance has increased by 100
      expect(balanceBefore.sub(balanceAfter)).to.equal(amount);

      // Check that the contract balance has increased by 100
      expect(
        contractBalanceAfter.sub(contractBalanceBefore).toString()
      ).to.equal("100");

      // Check that the token pool for the sender has increased by 100
      const tokenPoolAmount = await micro.tokenPools(payers[0].address);
      expect(tokenPoolAmount).to.equal(amount);
    });

    it("should emit an event", async () => {
      const amount = BigNumber.from("100");

      const tx = micro.connect(payers[0]).depositTokens(amount);

      await expect(tx)
        .to.emit(micro, "TokensDeposited")
        .withArgs(payers[0].address, amount);
    });
  });

  describe("claimPayments()", () => {
    before(async () => {
      const depositTokens = [];
      for (const signer of signers) {
        depositTokens.push(
          micro.connect(signer).depositTokens(BigNumber.from("100"))
        );
      }
      await Promise.all(depositTokens);
    });

    it("should claim payments", async () => {
      const microPayments: MicroPayment[] = [];

      const amount = BigNumber.from("5");

      for (const signer of signers) {
        const nonce = await generateRandomNonce(signer.address);

        const signature = await sign(
          signer,
          ["address", "uint256", "bytes32", "address"],
          [owner.address, amount, nonce, micro.address]
        );

        const microPayment: MicroPayment = {
          signature: signature,
          nonce: nonce,
          amount: amount,
          sender: signer.address,
        };

        microPayments.push(microPayment);
      }

      // Get the balance of the owner before
      const ownerBalanceBefore = await microToken.balanceOf(owner.address);

      // Get the token pool amount of each payer before
      const signerBalancesBefore = [];
      for (const signer of signers) {
        signerBalancesBefore.push(await micro.tokenPools(signer.address));
      }

      // Make transaction: Claim the payments
      const tx = micro.connect(owner).claimPayments(microPayments);

      expect(tx)
        .to.emit(micro, "PaymentClaimed")
        .withArgs(owner.address, amount);

      await tx;

      // Get the balance of the owner after
      const ownerBalanceAfter = await microToken.balanceOf(owner.address);

      // Get the token pool amount of each payer after
      for (let i = 0; i < signers.length; i++) {
        const signer = signers[i];
        const signerBalanceAfter = await micro.tokenPools(signer.address);

        // Check that the token pool amount has been adjusted
        expect(signerBalancesBefore[i].sub(signerBalanceAfter)).to.equal(
          microPayments[i].amount
        );

        // Check that the nonce has been added to the list of used nonces
        expect(await micro.usedNonces(microPayments[i].nonce)).to.equal(true);
      }

      // Check that the balance of the owner has increased by 5
      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(
        amount.mul(signers.length)
      );
    });

    it("should revert if sender is not owner", async () => {
      const signer = payers[0];
      const amount = BigNumber.from("5");
      const nonce = await generateRandomNonce(signer.address);

      const signature = await sign(
        signer,
        ["address", "uint256", "bytes32", "address"],
        [owner.address, amount, nonce, micro.address]
      );

      const microPayment: MicroPayment = {
        signature: signature,
        nonce: nonce,
        amount: amount,
        sender: signer.address,
      };

      const tx = micro.connect(signers[9]).claimPayments([microPayment]);

      await expect(tx).to.be.revertedWith("OnlyOwnerCanClaimPayments");
    });

    it("should revert if the same signature is provided twice", async () => {
      const signer = payers[0];
      const amount = BigNumber.from("5");
      const nonce = await generateRandomNonce(signer.address);

      const signature = await sign(
        signer,
        ["address", "uint256", "bytes32", "address"],
        [owner.address, amount, nonce, micro.address]
      );

      const microPayment: MicroPayment = {
        signature: signature,
        nonce: nonce,
        amount: amount,
        sender: signer.address,
      };

      await micro.connect(owner).claimPayments([microPayment]);
      const tx = micro.connect(owner).claimPayments([microPayment]);

      await expect(tx).to.be.revertedWith("NonceAlreadyUsed");
    });

    it("should revert if signatures with duplicate nonces are submitted", async () => {
      const amount = BigNumber.from("5");
      const signer1 = payers[0];
      const signer2 = payers[1];

      const nonce1 = await generateRandomNonce(signer1.address);
      const signature1 = await sign(
        signer1,
        ["address", "uint256", "bytes32", "address"],
        [owner.address, amount, nonce1, micro.address]
      );

      const nonce2 = nonce1;
      const signature2 = await sign(
        signer2,
        ["address", "uint256", "bytes32", "address"],
        [owner.address, amount, nonce2, micro.address]
      );

      const microPayment1: MicroPayment = {
        signature: signature1,
        nonce: nonce1,
        amount: amount,
        sender: signer1.address,
      };

      const microPayment2: MicroPayment = {
        signature: signature2,
        nonce: nonce2,
        amount: amount,
        sender: signer2.address,
      };

      const tx = micro
        .connect(owner)
        .claimPayments([microPayment1, microPayment2]);

      await expect(tx).to.be.revertedWith("NonceAlreadyUsed");
    });
  });
});
