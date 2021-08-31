// RequestNetwork is the interface we will use to interact with the Request network
import * as RequestNetwork from "@requestnetwork/request-client.js";
// The signature provider allows us to sign the request
import { EthereumPrivateKeySignatureProvider } from "@requestnetwork/epk-signature";
// The payment methods are in a separate package
import {
  payRequest,
  approveErc20IfNeeded,
} from "@requestnetwork/payment-processor";
// The smart-contract package contains exports some standard Contracts and all of Request contracts
import { TestERC20__factory } from "@requestnetwork/smart-contracts/types";

import { ethers, Wallet } from "ethers";

//#region Local ERC20 Config
const provider = new ethers.providers.JsonRpcProvider() as ethers.providers.Provider;

// this is a local ERC20 token deployed on ganache
const localToken = "0x38cF23C52Bb4B13F051Aec09580a2dE845a7FA35";
const erc20 = TestERC20__factory.connect(localToken, provider);

//#endregion

//#region Wallets setup
// For the sake of simplicity, we use a single mnemonic for all wallets.
const mnemonic =
  "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

// Each actor has 2 wallets, one for identity (used to sign stuff) and one for payments

// NB: this wallet needs to stay the /1 since it's the only one with fake ERC20Alpha
const payerPaymentWallet = Wallet.fromMnemonic(
  mnemonic,
  "m/44'/60'/0'/0/0"
).connect(provider);
const payerIdentityWallet = Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/1");

const payeePaymentWallet = Wallet.fromMnemonic(
  mnemonic,
  "m/44'/60'/0'/0/2"
).connect(provider);
const payeeIdentityWallet = Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/3");

//#endregion

//#region Identity setup
// Payee Identity & Private key
const payeeIdentity = {
  type: RequestNetwork.Types.Identity.TYPE.ETHEREUM_ADDRESS,
  value: payeeIdentityWallet.address,
};
const payeeSignatureInfo = {
  method: RequestNetwork.Types.Signature.METHOD.ECDSA,
  privateKey: payeeIdentityWallet.privateKey,
};

// Payer Identity & Private key
const payerIdentity = {
  type: RequestNetwork.Types.Identity.TYPE.ETHEREUM_ADDRESS,
  value: payerIdentityWallet.address,
};
const payerSignatureInfo = {
  method: RequestNetwork.Types.Signature.METHOD.ECDSA,
  privateKey: payeeIdentityWallet.privateKey,
};

//#endregion

//#region RequestNetwork setup
// ✏️ Signature provider
const signatureProvider = new EthereumPrivateKeySignatureProvider(
  payeeSignatureInfo
);

// Initialize RequestNetwok with signature provider and the node connection configuration
const requestNetwork = new RequestNetwork.RequestNetwork({
  signatureProvider,
  useMockStorage: true,
  currencies: [
    {
      address: localToken,
      decimals: 18,
      network: "private",
      symbol: "ERC20Alpha",
      type: RequestNetwork.Types.RequestLogic.CURRENCY.ERC20,
    },
  ],
});
//#endregion

//#region Request setup
// ✏️ Payment network information
const paymentNetwork: RequestNetwork.Types.Payment.IPaymentNetworkCreateParameters =
  {
    id: RequestNetwork.Types.Payment.PAYMENT_NETWORK_ID.ERC20_PROXY_CONTRACT,
    parameters: {
      paymentAddress: payeePaymentWallet.address,
    },
  };

// ✏️ The main request info: 1 TestERC20 from Payee to Payer
const requestInfo: RequestNetwork.Types.IRequestInfo = {
  currency: "ERC20Alpha",
  expectedAmount: ethers.utils.parseEther("1").toString(),
  payee: payeeIdentity,
  payer: payerIdentity,
};
//#endregion

(async () => {
  // ✏️ Create the request
  const request = await requestNetwork.createRequest({
    requestInfo,
    paymentNetwork,
    signer: payeeIdentity,
  });
  console.log(`request ${request.requestId} created`);
  await request.waitForConfirmation();
  console.log(`request ${request.requestId} confirmed`);

  // ✏️ Accept the request

  console.log(`Before payment`);
  console.log(
    `Payee: ${(await erc20.balanceOf(payeePaymentWallet.address)).toString()}`
  );
  console.log(
    `Payer: ${(await erc20.balanceOf(payerPaymentWallet.address)).toString()}`
  );

  // ✏️ Pay the request

  await approveErc20IfNeeded(
    request.getData(),
    payerPaymentWallet.address,
    payerPaymentWallet
  );

  const tx = await payRequest(request.getData(), payerPaymentWallet);
  console.log(`Payment tx: ${tx.hash}`);
  await tx.wait(1);
  console.log(`After payment`);

  console.log(
    `Payee: ${(await erc20.balanceOf(payeePaymentWallet.address)).toString()}`
  );
  console.log(
    `Payer: ${(await erc20.balanceOf(payerPaymentWallet.address)).toString()}`
  );
  await request.refreshBalance();
  console.log("Balance", request.getData().balance.balance);
})();
