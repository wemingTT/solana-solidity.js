const { Connection, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const { Contract, publicKeyToHex } = require('@solana/solidity');
const { readFileSync } = require('fs');

const ERC20_ABI = JSON.parse(readFileSync('./build/ERC20.abi', 'utf8'));
const BUNDLE_SO = readFileSync('./build/bundle.so');

(async function () {
    console.log('Connecting to your local Solana node ...');
    const connection = new Connection('http://localhost:8899', 'confirmed');

    const payer = Keypair.generate();

    console.log('Airdropping SOL to a new wallet ...');
    const signature = await connection.requestAirdrop(payer.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature, 'confirmed');

    const address = publicKeyToHex(payer.publicKey);
    const program = Keypair.generate();
    const storage = Keypair.generate();

    const contract = new Contract(
        connection,
        program.publicKey,
        storage.publicKey,
        ERC20_ABI,
        payer
    );

    console.log('Deploying the Solang-compiled ERC20 program ...');
    await contract.load(program, BUNDLE_SO);

    console.log('Program deployment finished, deploying the ERC20 contract ...');
    await contract.deploy(
        'ERC20',
        ['Solana', 'SOL', '1000000000000000000'],
        program,
        storage,
        4096 * 8
    );

    console.log('Contract deployment finished, invoking some contract functions ...');
    const symbol = await contract.symbol();
    const balance = await contract.balanceOf(address);

    console.log(`ERC20 contract for ${symbol} deployed!`);
    console.log(`Your wallet at ${address} has a balance of ${balance} tokens.`);

    contract.addEventListener(function (event) {
        console.log(`${event.name} event emitted!`);
        console.log(`${event.args[0]} sent ${event.args[2]} tokens to ${event.args[1]}`);
    });

    console.log('Sending tokens will emit a "Transfer" event ...');
    const recipient = Keypair.generate();
    await contract.transfer(publicKeyToHex(recipient.publicKey), '1000000000000000000');

    process.exit(0);
})();