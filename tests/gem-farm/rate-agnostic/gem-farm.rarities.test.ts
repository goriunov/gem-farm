import { BN } from '@project-serum/anchor';
import chai, { assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { defaultFarmConfig, GemFarmTester } from '../gem-farm.tester';
import { RarityConfig } from '../gem-farm.client';
import { Keypair, PublicKey } from '@solana/web3.js';
import { toBN } from '../../gem-common/types';

chai.use(chaiAsPromised);

describe('rarities', () => {
  let gf = new GemFarmTester();

  beforeEach('preps accs', async () => {
    await gf.prepAccounts(new BN(10000));
    await gf.callInitFarm(defaultFarmConfig);
    await gf.callInitFarmer(gf.farmer1Identity);
  });

  it('records single rarity via MultipleRarities call', async () => {
    const configs = [
      {
        mint: gf.gem1.tokenMint,
        rarityPoints: 10,
      } as RarityConfig,
    ];
    await gf.callAddRaritiesToBank(configs);

    const [rarityAddr] = await gf.findRarityPDA(
      gf.bank.publicKey,
      gf.gem1.tokenMint
    );
    const rarityAcc = await gf.fetchRarity(rarityAddr);
    assert.equal(rarityAcc.points, 10);
  });

  it('records multiple rarities', async () => {
    const configs: RarityConfig[] = [];
    const rarityAddresses: PublicKey[] = [];

    //(!) EMPIRICAL TESTING SHOWED CAN'T GO ABOVE 7, TX SIZE BECOMES TOO BIG
    for (let i = 0; i < 7; i++) {
      const mint = Keypair.generate().publicKey;

      const [rarityAddr] = await gf.findRarityPDA(gf.bank.publicKey, mint);

      configs.push({
        mint,
        rarityPoints: 10,
      });
      rarityAddresses.push(rarityAddr);
    }

    await gf.callAddRaritiesToBank(configs);

    const results = await Promise.all(
      rarityAddresses.map((a) => gf.fetchRarity(a))
    );
    results.forEach((r) => assert.equal(r.points, 10));
  });

  it('correctly counts rarity points during deposits/withdrawals', async () => {
    //add rarities for gem1 mint
    const configs = [
      {
        mint: gf.gem1.tokenMint,
        rarityPoints: 15,
      } as RarityConfig,
    ];
    await gf.callAddRaritiesToBank(configs);

    await gf.callDeposit(gf.gem1Amount, gf.farmer1Identity);

    const farm = await gf.fetchFarm();
    const [vault] = await gf.findVaultPDA(
      farm.bank,
      gf.farmer1Identity.publicKey
    );
    let vaultAcc = await gf.fetchVaultAcc(vault);
    assert(vaultAcc.gemCount.eq(gf.gem1Amount));
    assert(vaultAcc.rarityPoints.eq(gf.gem1Amount.mul(toBN(15))));

    await gf.callWithdraw(gf.gem1Amount, gf.farmer1Identity);

    vaultAcc = await gf.fetchVaultAcc(vault);
    assert(vaultAcc.gemCount.eq(toBN(0)));
    assert(vaultAcc.rarityPoints.eq(toBN(0)));
  });
});