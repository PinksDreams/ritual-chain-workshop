// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract PrecompileConsumer {
    // Placeholder address for a Ritual-style LLM precompile.
    // In a real Ritual deployment, replace this with the official precompile address/interface.
    address internal constant LLM_PRECOMPILE = address(0x0000000000000000000000000000000000000801);

    function _callLLM(bytes memory input) internal returns (bytes memory) {
        (bool ok, bytes memory result) = LLM_PRECOMPILE.call(input);
        require(ok, "LLM precompile call failed");
        return result;
    }
}