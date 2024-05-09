# Program Architecture

We implement futarchy via three programs:

* **Conditional vault:** what allows the creation of conditional tokens, which in turn is what allows for conditional markets.
* **Autocrat:** the program that coordinates futarchy. Allows the creation of DAOs and proposals, and allows proposals to be finalized based on the prices in the conditional markets.
* **AMM:** we need to get on-chain time-weighted average prices of the conditional markets. Existing Solana-based CPAMMs didn't provide TWAP oracles, so we have an AMM program that provides one.

### Conditional vault program <a href="#conditional-vault-program" id="conditional-vault-program"></a>

In a conditional market, you must revert all trades when the condition isn't met. Blockchains like Solana don't allow you to revert transactions after they've been finalized, so we need a mechanism to _simulate_ reverting transactions. That mechanism is conditional tokens.

Before minting conditional tokens, someone needs to create a _conditional vault_. Conditional vaults are each tied to a specific _underlying token, settlement authority,_ and _proposal_.

Once a vault is created, anyone can deposit underlying tokens in exchange for conditional tokens. You receive two types of conditional tokens: ones that are redeemable for underlying tokens if the vault is finalized and ones that are redeemable for underlying tokens if the vault is reverted. For example, if you deposit 10 USDC into a vault, you will receive 10 conditional-on-finalize USDC and 10 conditional-on-revert USDC.

<figure><img src="../.gitbook/assets/image.png" alt=""><figcaption></figcaption></figure>

The settlement authority can either _finalize_ or _revert_ a vault.

If the settlement authority finalizes a vault, users can redeem their conditional-on-finalize tokens for underlying tokens. Conversely, if the settlement authority reverts a vault, users can redeem their conditional-on-revert tokens for underlying tokens.

<figure><img src="../.gitbook/assets/image (1).png" alt=""><figcaption></figcaption></figure>

There should be two vaults for each proposal: a base vault and a quote vault. The base vault uses the DAO's token as the underlying token, and the quote vault uses USDC as the underlying token. For example, MetaDAO proposals have vaults for META and USDC.

While a proposal is live, traders can deposit their underlying tokens for conditional tokens. If the proposal passes, both vaults are finalized. If it fails, both are reverted.

<figure><img src="../.gitbook/assets/image (2).png" alt=""><figcaption></figcaption></figure>





