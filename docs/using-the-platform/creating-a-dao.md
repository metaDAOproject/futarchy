# Creating a DAO

So, you want to use futarchy for your project - great! To create a futarchy, you can specify a few parameters:

* **Proposal time**: the amount of time a proposal should be active before it can pass or fail. Three days by default. Specified in Solana slots.
* **Pass threshold:** the percentage that the pass price needs to be above the fail price in order for a proposal to pass.
* **Min liquidity:** to prevent spam, proposers are required to lock AMM liquidity in their proposal markets. The amount they are required to lock, in both USDC and the futarchy's token, is specified by each DAO.
* **TWAP sensitivity parameters:** as explained in the price oracle section, the price that gets factored into the TWAP can only move by a certain dollar amount per minute. Each DAO must specify this dollar amount. We recommend 1-5% of the spot price.

Once these parameters are decided, you can reach out to Proph3t (@metaproph3t on Twitter, Telegram, and Discord) to create the DAO for you. Today, we're working with a small number of DAOs, but we will eventually make this a permissionless process.
