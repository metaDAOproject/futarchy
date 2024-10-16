# Value Resolved Decision Markets
MetaDAO's value based decision making program is adaptable for many different applications. In Hanson's paper he proposes we vote on values but bet on beliefs, therefore this is an iterative step in that direction. 

In some cases the underlying value may not be directly measurable (value accretive to the business) but can be measured discretely within a criteria framework, or perhaps many values may be assessed in aggregate.

Hanson's example of GDP, health, leisure, happiness and environment are all examples of measures which could be impacted through the use of this system. While you may not be able to trade health in any practical sense, these specialized contracts payout relative to a future measure against the value.

These markets must be resolved to do so we propose an initial structure in line with current existing committees, boards or members within DAOs. These members would be responsible for executing the measurement as outlined within a robust framework or rubric.

With the advancement of oracles and on-chain data there exists a certain future where the practicality of automated resolution is within reach. However the current implementation is designed around flexibility with the status quo.

What ideas might you want to see evaluated or examples you'd be interested in experimenting with? Join the [MetaDAO Discord](https://discord.gg/metadao) and let us know!

## Examples
We've designed the product based on consumer demand, but by no means is it constrained to ONLY these examples.

### Grants

The following is a guide for use within a grants program and what will be required from you if you'd like to implement the system.

<figure><img src="../.gitbook/assets/grant-summary.png" alt="Grant Process Overview"><figcaption></figcaption></figure>

#### Pre-requisites
First, MetaDAO will need the following:

- Rubric: a rubric for evaluating grants’ effectiveness. This is what traders will use to price a grant and determine whether it should be allowed to go through. An example is [here](../examples/rubric.md).
- Desired minimum liquidity: how much liquidity you’d like to see in a grant market at a minimum. We recommend from $2k to $20k, where minimum liquidity is at least 20% of the average expected size of grant. More liquidity means a stronger incentive to correctly price a market.
- Desired grant size: how much grantees should be able to request, and whether this is fixed or if there’s a range that grants can request from.
- Desired threshold: how effective you want the market to rate a grant before it's awarded, based on your criteria. For example, '50%' or '85%.'
- Trading period: how long the markets will run for. We recommend 3 days.

#### Grant Lifecycle
<figure><img src="../.gitbook/assets/grant-flow-chart.png" alt="Flow Of  Decision Market For Grants"><figcaption></figcaption></figure>
In our system, grants go through several stages:

- Ideation
- Decision market
- Spot market
- Resolution

##### Ideation
First, someone needs to come up with an idea for a prospective grant. Once they’ve determined that they’re willing to do it, they’ll write a grant proposal. This proposal can optionally follow your own template.

##### Decision market
<figure><img src="../.gitbook/assets/grant-ideation-decision-market.png" alt="Decision Market For Grants"><figcaption></figcaption></figure>
Once a prospective grantee has written up their grant proposal, we help them create a decision market.

In the decision market, traders trade on what would be the effectiveness score of this grant if it were given?

People can bet that a grant will be effective by buying E-UP tokens. They can bet that a grant will be ineffective by buying E-DOWN tokens. This is analogous to prediction market traders buying YES and NO tokens. E-UP tokens pay out relative to the effectiveness of the grant, and E-DOWN pays out the inverse. For example, if a grant is deemed as 78% effective, E-UP will pay out $0.78 and E-DOWN will pay out $0.22.

The market price of E-UP represents the market’s view on how effective a grant will be.

After the trading period, the grant will be either accepted or rejected. If it’s rejected, all traders get their money back and no money is sent to the grantee. If it’s accepted, the money will be sent by whatever means you prefer (e.g., out of a Squads multisig).

##### Spot market
<figure><img src="../.gitbook/assets/grant-spot-evaluation.png" alt="Spot Market With Evaulation"><figcaption></figcaption></figure>
If a grant is given, we leave the E-UP and E-DOWN markets open. This allows traders to liquidate their position if the market has already priced in their beliefs. This also allows the market to continuously evaluate the grantee.

##### Resolution
After the time period specified in the rubric, the grant is graded. Its score is fed into an oracle so that traders can redeem their E-UP and E-DOWN for cash. This concludes the process and the markets.
