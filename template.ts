// The signature provider allows us to sign the request
import { EthereumPrivateKeySignatureProvider } from '@requestnetwork/epk-signature';
// RequestNetwork is the interface we will use to interact with the Request network
import * as RequestNetwork from '@requestnetwork/request-client.js';

import { payRequest, approveErc20IfNeeded } from "@requestnetwork/payment-processor";

import { ethers } from "ethers";

// Here we declare the payee identity, with the payee identity ethereum address
const payeeIdentity = {
    type: RequestNetwork.Types.Identity.TYPE.ETHEREUM_ADDRESS,
    value: '0x02Eb660017B085B6e33BC4eCa88b545320753501',
};
// Here we declare the (optional, but recommended) payer identity address.
const payerIdentity = {
    type: RequestNetwork.Types.Identity.TYPE.ETHEREUM_ADDRESS,
    value: '0xd39e659BDA21Ea7252f75875EB88d9292f5ED95f',
};

// The signature info requires the request creator private key.
// For this demo purposes, we hard-coded the private key. Please be careful with how you store and handle your private key since it's a very sensitive piece of data.
const payeeSignatureInfo = {
    method: RequestNetwork.Types.Signature.METHOD.ECDSA,
    privateKey: '0x0c5b39501a954ee233dc632149dabb88e2b94f599f0201aafb85012f9b59723b',
  };
const payerSignatureInfo = {
    method: RequestNetwork.Types.Signature.METHOD.ECDSA,
    privateKey: '0x7e1d3bc9732f61fc9ecaa5a2ad2ca50ade7e61f3d29cf17ba41d30634218cd88',
  };

const signatureProvider = new EthereumPrivateKeySignatureProvider(payeeSignatureInfo);
signatureProvider.addSignatureParameters(payerSignatureInfo);

// We can initialize the RequestNetwork class with the signature provider and inform we will be using the mock storage.
const requestNetwork = new RequestNetwork.RequestNetwork({
    signatureProvider,
    // useMockStorage: true,
    nodeConnectionConfig: { baseURL: 'https://gateway-rinkeby.request.network/' },

});

// The main request info, with the currency, amount (in the smallest denominator), payee identity and payer identity
const requestInfo: RequestNetwork.Types.IRequestInfo = {
    currency: {
      network: 'rinkeby',
      type: RequestNetwork.Types.RequestLogic.CURRENCY.ERC20,
      value: '0xFab46E002BbF0b4509813474841E0716E6730136',
    },
    expectedAmount: '1000000000000000000', // 1 FAU
    payee: payeeIdentity,
    payer: payerIdentity,
  };

const paymentNetwork: RequestNetwork.Types.Payment.IPaymentNetworkCreateParameters = {
    id: RequestNetwork.Types.Payment.PAYMENT_NETWORK_ID.ERC20_PROXY_CONTRACT,
    parameters: {
      paymentAddress: payeeIdentity.value,
    },
  };
  const proxyContractCreateParams = {
    paymentNetwork,
    requestInfo,
    signer: payeeIdentity,
  };


const network = "rinkeby";

// Specify your own API keys
// Each is optional, and if you omit it the default
// API key for that service will be used.
const provider = new ethers.providers.InfuraProvider(network, 'aeae830838614da186df7984467a2d2d');
const wallet = new ethers.Wallet(payerSignatureInfo.privateKey, provider);

// Finally create the request and print its id
(async () => {
    console.log('createRequest...');
    const request = await requestNetwork.createRequest(proxyContractCreateParams);
    console.log(`Request created with erc20 proxy contract payment network: ${request.requestId}`);

    console.log('waitForConfirmation...');
    request.waitForConfirmation();

    console.log('accept...');
    await request.accept(payerIdentity);

    console.log('waitForConfirmation...');
    request.waitForConfirmation();
    
    // console.log('fromRequestId...');
    // const request = await requestNetwork.fromRequestId('0162d107a2d765177471d8ce337126f257f846deb2d3793876d537ad97d289f03c');

    const requestData = request.getData();

    console.log('approve...');
    const approval = await approveErc20IfNeeded(requestData, payerIdentity.value, wallet);
    if(approval) {
        console.log('wait...');
        await approval.wait();
    }
    console.log('payRequest...');
    const payment = await payRequest(requestData, wallet);
    console.log('wait...');
    await payment.wait();


    console.log('refresh...');
    const reqToShow = await request.refresh();
    console.log('reqToShow');
    console.log(reqToShow);
    console.log('reqToShow.balance');
    console.log(reqToShow.balance);
    console.log('reqToShow.state');
    console.log(reqToShow.state);
})();