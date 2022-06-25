//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Micro {
    address private owner;
    IERC20 private token;

    mapping(address => bytes32) public periodNonces;
    mapping(address => uint256) public periodTotals;
    mapping(bytes32 => bool) public usedNonces;
    mapping(address => uint256) public tokenPools;

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct MicroPayment {
        Signature signature;
        bytes32 nonce;
        uint256 amount;
        address sender;
    }

    event PaymentClaimed(address recipient, uint256 amount);
    event TokensDeposited(address payer, uint256 amount);

    error OnlyOwnerCanClaimPayments(address owner, address sender);
    error NonceAlreadyUsed(bytes32 nonce);
    error CouldNotVerifyMicroPayment(MicroPayment microPayment);
    error SenderHasInsufficientFunds(
        address payer,
        uint256 amount,
        uint256 senderBalance
    );

    constructor(address _contractOwner, IERC20 _token) {
        owner = _contractOwner;
        token = _token;
    }

    /// @notice Deposits tokens into the contract to be claimed by the owner
    /// upon successful verification of a signature. May be called by anyone.
    /// @param _amount The amount of tokens to deposit
    /// @return True if successful
    function depositTokens(uint256 _amount) external returns (bool) {
        // Add the amount to the sender's token pool
        tokenPools[msg.sender] += _amount;

        // Transfer the token to the contract
        token.transferFrom(msg.sender, address(this), _amount);

        // Initialize a nonce for the sender (subscriber), only if it doesn't
        // exist. The nonce is any unique bytes32 value. In this case the nonce
        // is a hash of the sender's address and the current block's timestamp.
        // The nonce is used to prevent replay attacks.
        if (periodNonces[msg.sender] == 0) {
            periodNonces[msg.sender] = generateNonce(msg.sender);
        }

        emit TokensDeposited(msg.sender, _amount);

        return true;
    }

    /// @notice An admin claims payments by submitting signatures from payers.
    /// The contract verifies the signatures and transfers tokens to the sender.
    /// This begins a new period.
    /// @dev There is no validation in this function to check that the funds
    /// exist in the contract. Validation should be done off chain before
    /// calling this function by adding the amounts and checking the balance on
    /// the contract. Otherwise a large cost in transaction fees could be
    /// incurred on the sender by looping through each payment.
    /// @param _microPayments Contains the signatures to verify.
    /// @return True if successful
    function claimPayments(MicroPayment[] memory _microPayments)
        external
        returns (bool)
    {
        // Confirm that the sender is the contract owner
        if (msg.sender != owner) {
            revert OnlyOwnerCanClaimPayments(owner, msg.sender);
        }

        // Define a value that sums the total to be transferred
        uint256 total = 0;

        for (uint256 i = 0; i < _microPayments.length; i++) {
            MicroPayment memory payment = _microPayments[i];

            // Confirm that the nonce has not been used yet
            if (usedNonces[payment.nonce]) {
                revert NonceAlreadyUsed(payment.nonce);
            }

            // Confirm that the payer has the amount in their pool
            if (tokenPools[payment.sender] < payment.amount) {
                revert SenderHasInsufficientFunds(
                    payment.sender,
                    payment.amount,
                    tokenPools[payment.sender]
                );
            }

            // Contruct the message
            bytes32 message = prefixed(
                keccak256(
                    abi.encode(
                        msg.sender,
                        payment.amount,
                        payment.nonce,
                        address(this)
                    )
                )
            );

            // Verify the message.
            // The message can and definitely should also be verified off chain
            // because if just one of these signatures can't be verified the
            // entire transcation will revert.
            address hopefulAddress = ecrecover(
                message,
                payment.signature.v,
                payment.signature.r,
                payment.signature.s
            );
            if (hopefulAddress != payment.sender) {
                revert CouldNotVerifyMicroPayment(payment);
            }

            // Remove the amount from the sender's token pool
            tokenPools[payment.sender] -= payment.amount;

            // Add the nonce to usedNonces
            usedNonces[payment.nonce] = true;

            // Assign the subscriber a new nonce for this period
            periodNonces[payment.sender] = generateNonce(payment.sender);

            // Reset the subscriber's period total
            periodTotals[payment.sender] = 0;

            // Add the amount to the total
            total += payment.amount;
        }

        // Transfer the total to the sender
        token.transfer(msg.sender, total);

        emit PaymentClaimed(msg.sender, total);

        return true;
    }

    /// @notice Builds a prefixed hash to mimic the behavior of eth_sign.
    /// @param _hash The message to hash.
    /// @return The prefixed hash.
    function prefixed(bytes32 _hash) private pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash)
            );
    }

    /// @notice Generate a nonnce for the subscriber. This is the hash of an
    /// account and the current block's timestamp.
    /// @param _account The subscriber's address
    /// @return The nonce
    function generateNonce(address _account) private view returns (bytes32) {
        return keccak256(abi.encodePacked(_account, block.timestamp));
    }
}
