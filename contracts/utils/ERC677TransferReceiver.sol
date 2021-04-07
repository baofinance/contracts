// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

 /*
 * Contract interface for receivers of tokens that
 * comply with ERC-677.
 * See https://github.com/ethereum/EIPs/issues/677 for details.
 */
abstract contract ERC677TransferReceiver {
    function tokenFallback(address from, uint256 amount, bytes calldata data) external virtual returns (bool);
}