const Crowdsale = artifacts.require('./helpers/MockCubixCrowdsale.sol');
const Token = artifacts.require('./cubix/Cubixgroup.sol');
const DataCentre = artifacts.require('./token/DataCentre.sol');
const ControlCentre = artifacts.require('./controlCentre/ControlCentre.sol');
const MultisigWallet = artifacts.require('./multisig/solidity/MultiSigWalletWithDailyLimit.sol');
import {advanceBlock} from './helpers/advanceToBlock';
import latestTime from './helpers/latestTime';
import increaseTime from './helpers/increaseTime';
const BigNumber = require('bignumber.js');
const assertJump = require('./helpers/assertJump');
const ONE_ETH = web3.toWei(1, 'ether');
const MOCK_ONE_ETH = web3.toWei(0.000001, 'ether'); // diluted ether value for testing
const PRE_SALE_DAYS = 7;
const FOUNDERS = [web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3]];

// Full test of complete sale
contract('CubixCrowdsale', (accounts) => {
  let multisigWallet;
  let token;
  let startTime;
  let ends;
  let rates;
  let capTimes;
  let caps;
  let crowdsale;

  beforeEach(async () => {
    await advanceBlock();
    startTime = latestTime();
    rates = [1000, 800, 700, 600];
    ends = [startTime + 86400*30, startTime + 86400*40, startTime + 86400*50, startTime + 86400*60];

    capTimes = [startTime + 86400*30, startTime + 86400*60];
    caps = [20000000e18, 22000000e18];

    token = await Token.new();
    multisigWallet = await MultisigWallet.new(FOUNDERS, 3, 10*MOCK_ONE_ETH);
    crowdsale = await Crowdsale.new(startTime, ends, rates, token.address, multisigWallet.address, capTimes, caps);
    await token.transferOwnership(crowdsale.address);
    await crowdsale.unpause();
  });

  describe('#crowdsaleDetails', () => {
    it('should allow start crowdsale properly', async () => {
    // checking startTime
    const startTimeSet = await crowdsale.startTime.call();
    assert.equal(startTime, startTimeSet.toNumber(), 'startTime not set right');

    //checking initial token distribution details
    const initialBalance = await token.balanceOf.call(accounts[0]);
    assert.equal(28350000e18, initialBalance.toNumber(), 'initialBalance for sale NOT distributed properly');

    //checking token and wallet address
    const tokenAddress = await crowdsale.tokenAddr.call();
    const walletAddress = await crowdsale.wallet.call();
    assert.equal(tokenAddress, token.address, 'address for token in contract not set');
    assert.equal(walletAddress, multisigWallet.address, 'address for multisig wallet in contract not set');

    //list rates and check
    const rate = await crowdsale.listRates.call();
    rate[1].splice(rates.length);
    rate[0].splice(rates.length);

    assert.equal(rate[0][0].toNumber(), ends[0], 'endTime not set right');
    assert.equal(rate[0][1].toNumber(), ends[1], 'endTime not set right');

    assert.equal(rate[1][0].toNumber(), rates[0], 'swapRate not set right');
    assert.equal(rate[1][1].toNumber(), rates[1], 'swapRate not set right');
    });
  });

  describe('#unsuccesfulInitialization', () => {

    it('should not allow to start crowdsale if wallet address is address(0)',  async () => {
      let crowdsaleNew;
      try {
        crowdsaleNew = await Crowdsale.new(startTime, ends, rates, token.address, '0x00');
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleNew, undefined, 'crowdsale still initialized');
    });

    it('should not allow to start crowdsale due to rate length mismatch',  async () => {
      let crowdsaleNew;
      ends = [startTime + 86400, startTime + 86400*2, startTime + 86400*3, startTime + 86400*4, startTime + 86400*5];
      rates = [500, 400, 300, 200];
      try {
        crowdsaleNew = await Crowdsale.new(startTime, ends, rates, token.address, multisigWallet.address);
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleNew, undefined, 'crowdsale still initialized');
    });

    it('should not allow to start crowdsale if first end time smaller than startTime',  async () => {
      let crowdsaleNew;
      ends = [startTime - 2, startTime + 86400*2, startTime + 86400*3, startTime + 86400*4, startTime + 86400*5];
      rates = [500, 400, 300, 200, 100];
      try {
        crowdsaleNew = await Crowdsale.new(startTime, ends, rates, token.address, multisigWallet.address);
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleNew, undefined, 'crowdsale still initialized');
    });

    it('should not allow to start crowdsale if any rate is equal to zero',  async () => {
      let crowdsaleNew;
      ends = [startTime + 86400, startTime + 86400*2, startTime + 86400*3, startTime + 86400*4, startTime + 86400*5];
      rates = [500, 400, 300, 200, 0];
      try {
        crowdsaleNew = await Crowdsale.new(startTime, ends, rates, token.address, multisigWallet.address);
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleNew, undefined, 'crowdsale still initialized');
    });

    it('should not allow to start crowdsale if succesive endTimes not in ascending order',  async () => {
      let crowdsaleNew;
      ends = [startTime + 86400, startTime + 86400*3, startTime + 86400*2, startTime + 86400*4, startTime + 86400*5];
      rates = [500, 400, 300, 200, 0];
      try {
        crowdsaleNew = await Crowdsale.new(startTime, ends, rates, token.address, multisigWallet.address);
      } catch(error) {
        assertJump(error);
      }

      assert.equal(crowdsaleNew, undefined, 'crowdsale still initialized');
    });
  });


  describe('#purchase', () => {
    it('should allow investors to buy tokens at the 1st swapRate', async () => {
      const INVESTOR = accounts[4];

      // buy tokens
      await crowdsale.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});
      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const tokensBalance = await token.balanceOf.call(INVESTOR);

      const tokensAmount = new BigNumber(MOCK_ONE_ETH).mul(rates[0]);
      assert.equal(walletBalance.toNumber(), MOCK_ONE_ETH, 'ether not deposited into the wallet');
      assert.equal(tokensBalance.toNumber(), tokensAmount.toNumber(), 'tokens not deposited into the INVESTOR balance');
    });

    it('should allow investors to buy tokens at the 2nd swapRate', async () => {
      const INVESTOR = accounts[4];

      await increaseTime(ends[0] - startTime);

      // buy tokens
      await crowdsale.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});
      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const tokensBalance = await token.balanceOf.call(INVESTOR);

      const tokensAmount = new BigNumber(MOCK_ONE_ETH).mul(rates[1]);
      assert.equal(walletBalance.toNumber(), MOCK_ONE_ETH, 'ether not deposited into the wallet');
      assert.equal(tokensBalance.toNumber(), tokensAmount.toNumber(), 'tokens not deposited into the INVESTOR balance');
    });


    it('should allow investors to buy tokens at all swapRates across the crowdsales', async () => {
      const INVESTOR = accounts[4];

      // buy tokens
      await crowdsale.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});

      await increaseTime(ends[0] - startTime);
      await crowdsale.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});

      const tokensAmount = new BigNumber(MOCK_ONE_ETH).mul(rates[0] + rates[1]);
      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const tokensBalance = await token.balanceOf.call(INVESTOR);

      assert.equal(walletBalance.toNumber(), caps.length * MOCK_ONE_ETH, 'ether not deposited into the wallet');
      assert.equal(tokensBalance.toNumber(), tokensAmount.toNumber(), 'tokens not deposited into the INVESTOR balance');
    });
  });

  describe('#crowdsaleDetails', () => {
    it('should allow start crowdsale properly', async () => {
    // checking startTimes
    const startTimeSet = await crowdsale.startTime.call();
    assert.equal(startTime, startTimeSet.toNumber(), 'startTime not set right');

    //checking initial token distribution details
    const initialBalance = await token.balanceOf.call(accounts[0]);
    assert.equal(28350000e18, initialBalance.toNumber(), 'initialBalance for sale NOT distributed properly');

    //checking token and wallet address
    const tokenAddress = await crowdsale.tokenAddr.call();
    const walletAddress = await crowdsale.wallet.call();
    assert.equal(tokenAddress, token.address, 'address for token in contract not set');
    assert.equal(walletAddress, multisigWallet.address, 'address for multisig wallet in contract not set');

    // list caps and check
    const softCap = await crowdsale.listCaps.call();
    softCap[1].splice(caps.length);
    softCap[0].splice(caps.length);

    assert.equal(softCap[0][0].toNumber(), capTimes[0], 'endTime not set right');
    assert.equal(softCap[0][1].toNumber(), capTimes[1], 'endTime not set right');

    assert.equal(softCap[1][0].toNumber(), caps[0], 'swapRate not set right');
    assert.equal(softCap[1][1].toNumber(), caps[1], 'swapRate not set right');
    });
  });

  describe('#purchaseBelowCaps', () => {

    beforeEach(async () => {
      await crowdsale.diluteCaps();
    });

    it('should allow investors to buy tokens just below softCap in the 1st phase', async () => {
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((caps[0]/1e18)/rates[0]) - 1).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rates[0]).mul(amountEth);

      //  buy tokens
      await crowdsale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupplyPhase1 = await crowdsale.milestoneTotalSupply.call(0);
      const totalSupplyToken = await token.totalSupply.call();

      assert.equal(walletBalance.toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount.toNumber(), 'balance still added for investor');
      assert.equal(totalSupplyPhase1.toNumber(), tokensAmount.toNumber(), 'balance not added to totalSupply');
    });

    it('should allow investors to buy tokens just below softCap in the 2nd phase', async () => {
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((caps[1]/1e18)/rates[1]) - 1).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rates[1]).mul(amountEth);

      await increaseTime(capTimes[0] - startTime);

      //  buy tokens
      await crowdsale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupplyPhase1 = await crowdsale.milestoneTotalSupply.call(1);
      const totalSupplyToken = await token.totalSupply.call();

      assert.equal(walletBalance.toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount.toNumber(), 'balance still added for investor');
      assert.equal(totalSupplyPhase1.toNumber(), tokensAmount.toNumber(), 'balance not added to totalSupply');
    });

  });

  describe('#purchaseCaps', () => {

    beforeEach(async () => {
      await crowdsale.diluteCaps();
    });

    it('should allow investors to buy tokens just equal to softCap in the 1st phase', async () => {
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((caps[0]/1e18)/rates[0])).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rates[0]).mul(amountEth);

      //  buy tokens
      await crowdsale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupplyPhase1 = await crowdsale.milestoneTotalSupply.call(0);
      const totalSupplyToken = await token.totalSupply.call();

      assert.equal(walletBalance.toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount.toNumber(), 'balance still added for investor');
      assert.equal(totalSupplyPhase1.toNumber(), tokensAmount.toNumber(), 'balance not added to totalSupply');
    });

    it('should allow investors to buy tokens just equal to softCap in the 2nd phase', async () => {
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((caps[1]/1e18)/rates[1])).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rates[1]).mul(amountEth);

      await increaseTime(capTimes[0] - startTime);

      //  buy tokens
      await crowdsale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupplyPhase1 = await crowdsale.milestoneTotalSupply.call(1);
      const totalSupplyToken = await token.totalSupply.call();

      assert.equal(walletBalance.toNumber(), amountEth.toNumber(), 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), tokensAmount.toNumber(), 'balance still added for investor');
      assert.equal(totalSupplyPhase1.toNumber(), tokensAmount.toNumber(), 'balance not added to totalSupply');
    });

  });

  describe('#purchaseOverCaps', () => {

    beforeEach(async () => {
      await crowdsale.diluteCaps();
    });

    it('should not allow investors to buy tokens above softCap in the 1st phase', async () => {
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((caps[0]/1e18)/rates[0]) + 1).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rates[0]).mul(amountEth);

      //  buy tokens
      try {
        await crowdsale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
      } catch (error) {
        assertJump(error);
      }

      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupplyPhase1 = await crowdsale.milestoneTotalSupply.call(0);
      const totalSupplyToken = await token.totalSupply.call();
      assert.equal(walletBalance.toNumber(), 0, 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), 0, 'balance still added for investor');
      assert.equal(totalSupplyPhase1.toNumber(), 0, 'balance still added to totalSupply');
    });

    it('should not allow investors to buy tokens above softCap in the 2nd phase', async () => {
      const INVESTORS = accounts[4];
      const amountEth = new BigNumber(((caps[1]/1e18)/rates[1]) + 1).mul(MOCK_ONE_ETH);
      const tokensAmount = new BigNumber(rates[1]).mul(amountEth);

      await increaseTime(capTimes[0] - startTime);

      //  buy tokens
      try {
        await crowdsale.buyTokens(INVESTORS, {value: amountEth, from: INVESTORS});
      } catch (error) {
        assertJump(error);
      }

      const walletBalance = await web3.eth.getBalance(multisigWallet.address);
      const balanceInvestor = await token.balanceOf.call(INVESTORS);
      const totalSupplyPhase1 = await crowdsale.milestoneTotalSupply.call(1);
      const totalSupplyToken = await token.totalSupply.call();
      assert.equal(walletBalance.toNumber(), 0, 'ether still deposited into the wallet');
      assert.equal(balanceInvestor.toNumber(), 0, 'balance still added for investor');
      assert.equal(totalSupplyPhase1.toNumber(), 0, 'balance still added to totalSupply');
    });

  });

  it('should allow to setContracts in Crowdsale manually', async () => {
    await crowdsale.pause();

    const tokenNew = await Token.new();
    const multisigNew = await MultisigWallet.new(FOUNDERS, 3, 10*MOCK_ONE_ETH);
    await crowdsale.setContracts(tokenNew.address, multisigNew.address);
    assert.equal(await crowdsale.tokenAddr(), tokenNew.address, 'token contract not set');
    assert.equal(await crowdsale.wallet(), multisigNew.address, 'wallet contract not set');
  });

  it('should allow to transfer Token Ownership in Crowdsale manually', async () => {
    await crowdsale.pause();

    await crowdsale.transferTokenOwnership(multisigWallet.address);
    assert.equal(await token.owner(), multisigWallet.address, 'ownership not transferred');
  });

  it('should not allow to add and remove admins', async () => {

    await crowdsale.addAdmin(accounts[2]);
    await crowdsale.addAdmin(accounts[3]);

    assert.equal(await crowdsale.admins(1), accounts[2], 'governance not added');
    assert.equal(await crowdsale.admins(2), accounts[3], 'governance not added');

    await crowdsale.removeAdmin(accounts[2]);
    await crowdsale.removeAdmin(accounts[3]);

    try {
      await crowdsale.admins.call(1);
      assert.fail('should have failed before');
    } catch(error) {
      assertJump(error);
    }

    try {
      await crowdsale.admins.call(2);
      assert.fail('should have failed before');
    } catch(error) {
      assertJump(error);
    }
  });

  it('should allow to buy Token when not Paused', async () => {
    const INVESTOR = accounts[4];

    const walletBalanceBefore = await web3.eth.getBalance(multisigWallet.address);
    const tokensBalanceBefore = await token.balanceOf.call(INVESTOR);
    const tokensAmount = new BigNumber(rates[0]).mul(MOCK_ONE_ETH);

    await crowdsale.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});

    const walletBalanceAfter = await web3.eth.getBalance(multisigWallet.address);
    const tokensBalanceAfter = await token.balanceOf.call(INVESTOR);

    assert.equal(walletBalanceAfter.sub(walletBalanceBefore).toNumber(), MOCK_ONE_ETH, 'ether not deposited into the wallet');
    assert.equal(tokensBalanceAfter.sub(tokensBalanceBefore).toNumber(), tokensAmount.toNumber(), 'tokens not deposited into the INVESTOR balance');
  });

  it('should not allow to setContracts when not paused', async () => {

    const tokenNew = await Token.new();
    const multisigNew = await MultisigWallet.new(FOUNDERS, 3, 10*MOCK_ONE_ETH);

    try {
      await crowdsale.setContracts(tokenNew.address, multisigNew.address);
    } catch (error) {
      assertJump(error);
    }

    assert.equal(await crowdsale.tokenAddr(), token.address, 'token contract still set');
    assert.equal(await crowdsale.wallet(), multisigWallet.address, 'wallet contract still set');
  });

  it('should not allow to transfer Token Ownership in Crowdsale manually', async () => {

    const multisigNew = await MultisigWallet.new(FOUNDERS, 3, 10*MOCK_ONE_ETH);

    try {
      await crowdsale.transferTokenOwnership(multisigNew.address);
    } catch (error) {
      assertJump(error);
    }

    assert.equal(await token.owner(), crowdsale.address, 'ownership still transferred');
  });

  it('should not allow to buy Token when Paused', async () => {
    await crowdsale.pause();

    const INVESTOR = accounts[4];
    const walletBalanceBefore = await web3.eth.getBalance(multisigWallet.address);
    const tokensBalanceBefore = await token.balanceOf.call(INVESTOR);

    try {
      await crowdsale.buyTokens(INVESTOR, {value: MOCK_ONE_ETH, from: INVESTOR});
    } catch (error) {
      assertJump(error);
    }

    const walletBalanceAfter = await web3.eth.getBalance(multisigWallet.address);
    const tokensBalanceAfter = await token.balanceOf.call(INVESTOR);

    assert.equal(walletBalanceAfter.sub(walletBalanceBefore).toNumber(), 0, 'ether not deposited into the wallet');
    assert.equal(tokensBalanceAfter.sub(tokensBalanceBefore).toNumber(), 0, 'tokens not deposited into the INVESTOR balance');
  });
})
