# Meta-DAO

## Conditional Vault

At the core of Meta-DAO is the conditional vault construct. Conditional vaults issue conditional tokens in exchange for normal tokens. 

Conditional vaults are implemented as accounts which specify two things:
- a conditional expression
- the mint of the token that users of this vault wish to deposit

Conditional expressions are themselves accounts containing an improvement proposal number and a choice between pass and fail. 
