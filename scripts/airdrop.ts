import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

const cyberCapitalists = [
    "8Cwx4yR2sFAC5Pdx2NgGHxCk1gJrtSTxJoyqVonqndhq",
    "65U66fcYuNfqN12vzateJhZ4bgDuxFWN9gMwraeQKByg",
    "2fhVRoaTnsTumWr1PcYmeNzgy23nFRHSwZibqrgTffwd",
    "GMUb3TxU5f5ccyd3Tq8fwHqHbbqUDUQSLsYE3EG6YTn6",
    "HKcXZAkT4ec2VBzGNxazWhpV7BTk3frQpSufpaNoho3D",
    "2K9ZpC3LVqRfR8Vveo92LhiofbDcF6PuDRJbaPp9V34m",
    "UuGEwN9aeh676ufphbavfssWVxH7BJCqacq1RYhco8e",
    "C9pM5oPokgQb2KHwUt2MucCbfiGHRxXUwjd2W4Z9czJ2",
    "8ddc12hR2ePg4UkkWcecd9ShcNJyHrkBpLDjd8Yjn4GG",
    "EyuaQkc2UtC4WveD6JjT37ke6xL2Cxz43jmdCC7QXZQE",
    "5f2by8aDjTdt3TZznzUbAFPyqZHKwstVDQjEsw4qbEYj",
    "9ZMrcxM21yj3CvDaNww2ibdt4LxUbvb1EmdpWSmHsncQ",
    "BYeFEm6n4rUDpyHzDjt5JF8okGpoZUdS2Y4jJM2dJCm4",
    "qodhTms2ojNCZTjxbE4DNypzzanTHD5tMLGmSkgqRZb",
    "DJrUfgsWeqFGDaXLdbx7ibFwxAJvAX6dvNfRCgHrhFpt",
];

const technoAnalysts = [
    "2KpCd6yrCW3czNG9MH67QJ9whH7MXCD57hKNjDh51drb",
    "As63vJGYr8q3rZ2CrazfwMMNKHvfaosvaCmyRpAUz6KQ",
    "2qLWeNrV7QkHQvKBoEvXrKeLqEB2ZhscZd4ds7X2JUhn",
    "3PKhzE9wuEkGPHHu2sNCvG86xNtDJduAcyBPXpE6cSNt",
    "7uixr2n3aawRYFKu5L6Wjwf37Fe6Twh6Ns3upAPq9H7k",
    "HeYiTogWrqkCzAtGxwZSE6c4vASTEDeWekaGNw12NDf",
    "2REbnaK4fqpvH6uCN2nDSYe1LnKHB2Eocat7ifKUp8H2",
    "fk9QHmwHPpVoYydyHuopdvsoQffcgtttRLbJzSweH6X",
    "5jiQmWXnn7DWAp4iCYhRFMJnRRo3Vq1qvBh8TEao4E4D",
    "2xPi4mScQeyXk666VX3XAKoRgvtdyVLkzhg3NsPvrPTu",
    "7pPJt2xoEoPy8x8Hf2D6U6oLfNa5uKmHHRwkENVoaxmA",
    "J3X9s1G2aCRBi5e9mBuK9AxgBQemMSmX7Twp6b5UkRx4",
    "G5djAbi3DrZzrVmizfYteMpChyDV1nxqg2V77ftWpXKb",
    "5teVpxsERcfTDt7bSshLo21N4p5tRYfhNhL2b3PePCfy",
    "BcgYRPQC4mE3e195FmTx4mspmGbDx5xdcdKuLwNG89ov",
    "85CG4xpWqCLx6xKdR2SztPEfnh3oFkrFJs38bakTu7a7",
    "BADqAHSAXSV9yYT8kwyCmVhqX88UT4LViY9bozLr7XFr",
    "En5opU25LPm6GrHWLa3osBuPTSg3QyUg5EM1RR9sgfLn",
    "4VWRzPXpLqTRk66oKZiubq5jRcfwy9B1d1xRCmyvyxou",
    "Ev7kp4NfhVjvUqKMwhKCcvXRb2t828gDaSqWsD2gtPzT",
    "6VsPtfzuDabgbqodS75RD6yJRuryRB9on3AdywoRzJqH",
    "G2ocErqfp9Youi4yLW1Ag5XyEaMv3aGwGTjqbnEBQMs7",
    "6PqbMrA7PiGvNqvbyNTtJ29sS1QeSEVdmQ217LzBKmDe",
    "DMYmbEDY7L5RaNPZdGGk81GvMBfsiBQf4sKrtvLMVuCF",
    "6M1zVyfxQeyJ2HoesoAVXYjuG51MjCN58o2d7tG4iRC",
    "skynetDj29GH6o6bAqoixCpDuYtWqi1rm8ZNx1hB3vq",
    "F4KWGvT7woChii61HVj6hu1PAWWTKYS9u81sAeEszg2u",
    "ELE2KdFEUEjP3mEcFjfdbixQQ4UdctFGureygURHWg7f",
    "Cx8dCc33rWVu6VSBtNLaXyN17JjkSdEUGZvRkxkfzwsV",
    "GazTuZbs9ATANW3wAq2xg6Rc2cFDXmm3hweeuBKJzXrF",
    "ph2P85HjyReb1F33vM2XrxuVaVaR2drdV7SquBuwqGJ",
    "AiXexmUUiEq9oaaXsGHfFwjX32whTx8tMMXVaGfrrQJd",
    "FT2dv3yNxSjTkF2zUytWycZCwXc68xUmLNgkH8ugTaX6",
    "FfTDZaqQiSEtuLeaRZnZ2GHmkqRUxcnpEXbea5JWrhRp",
    "G1p59D3CScwE9r31RNFsGm3q5xZapt6EXHmtHV7Jq5AS",
    "En5opU25LPm6GrHWLa3osBuPTSg3QyUg5EM1RR9sgfLn",
    "CKKqtVFVjzdHvmxRUG6BzRsNTu6sZTgHsuBRWg5XQ1WS",
    "3jpph7Xjohc1sxXpgPhKz38Yng7x7gi9aDmXSCCsWyK6",
    "4ARYaJ6ER7VgWDBZmisazgL7R6PwzjAJhwpknQV3f2EQ",
    "AQjwvtpgZRSy2dmS9ztGZgbQDu7xM9abrin3wSqKRD1r",
    "844fKP7j6XuUgVffVzhmSSZLYSQdmiL6G8uZpXvD5NXu",
    "robrerZh1xEKpEVpA6XbfZ6UKAHkg94RTh4UjZ3acPV",
    "2pzXYcf1gNkS1QdJKGDLg8Cd1AFNMgBt7xLyiWrNZcJb",
    "EGNPfLtNe4WAcAQpnNwmehmEANCgj7FnqLUHfT54eVgV",
];

async function main() {
    const META = new anchor.web3.PublicKey("METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr");

    const senderAcc = await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        META,
        payer.publicKey,
    );

    for (let receiver of cyberCapitalists) {
        const CYBER_CAPITALIST_META = 333 * 1_000_000_000;

        let receiverPubkey = new anchor.web3.PublicKey(receiver);

        const receiverAcc = await token.getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            META,
            receiverPubkey
        );

        await token.transfer(
            provider.connection,
            payer,
            senderAcc.address,
            receiverAcc.address,
            payer,
            CYBER_CAPITALIST_META
        );
    }

    for (let receiver of technoAnalysts) {
        const TECHNO_ANALYST_META = 113 * 1_000_000_000;

        let receiverPubkey = new anchor.web3.PublicKey(receiver);

        const receiverAcc = await token.getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            META,
            receiverPubkey
        );

        await token.transfer(
            provider.connection,
            payer,
            senderAcc.address,
            receiverAcc.address,
            payer,
            TECHNO_ANALYST_META
        );
    }
}

main();
//   const storedDAO = await autocratProgram.account.dao.fetch(dao);