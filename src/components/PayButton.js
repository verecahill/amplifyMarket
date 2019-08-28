import React from "react";
import { API, graphqlOperation } from 'aws-amplify';
import { getUser } from '../graphql/queries';
import StripeCheckout from 'react-stripe-checkout';
import { createOrder } from "../graphql/mutations";
import { Notification, Message } from "element-react";
import { history } from '../App';


const stripeConfig = {
  currency: "USD",
  stripeKey: process.env.REACT_APP_stripeKey
}

const PayButton = ({ product, userAttributes }) => {

  const getOwnerEmail = async ownerId => {
    try{
      const input = { id: ownerId }
      const result = await API.graphql(graphqlOperation(getUser, input))
      return result.data.getUser.email

    }catch (err){
      console.log(`Error fetching product owner's email`, err)
    }
  }

  const createShippingAddress = source => {

    let state = source.address_state == null ? source.address_country : source.address_state
    
    return {
      city: source.address_city,
      country: source.address_country,
      address_line1: source.address_line1,
      address_state: state,
      address_zip: source.address_zip,
    }
  }


  const handleCharge = async token => {
    try {
      const ownerEmail = await getOwnerEmail(product.owner)
      console.log({ ownerEmail })

      const result = await API.post('orderlambda', '/charge', {
        body: {
          token,
          charge: {
            currency: stripeConfig.currency,
            amount: product.price,
            description: product.description
          },
          email: {
            customerEmail: userAttributes.email,
            ownerEmail,
            shipped: product.shipped,
          }
        }
      })
      console.log({ result })
      if (result.charge.status === "succeeded") {
         let shippingAddress = null;
         if (product.shipped){
           shippingAddress = createShippingAddress(result.charge.source)
         }
         const input = {
           orderUserId: userAttributes.sub,
           orderProductId: product.id,
           shippingAddress
         }
         const order = await API.graphql(graphqlOperation(createOrder, { input }))
         console.log({ order })
         Notification({
           title: "Success",
           message: `${result.message}`,
           type: 'success',
           duration: 3000,
           onClose: () => {
             history.push('/')
             Message({
               type: 'info',
               message: 'Check your verified email for order details',
               duration: 5000,
               showClose: true
            })
          }
         })
      }

    } catch(err){
      console.error(err);
      Notification.error({
        title: "Error",
        message: `${err.message || 'Error processing order'}`
      })
    }
  }

  return (
    <StripeCheckout 
      token={handleCharge}
      stripeKey={stripeConfig.stripeKey}
      email={userAttributes.email}
      name={product.description}
      amount={product.price}
      currency={stripeConfig.currency}
      shippingAddress={product.shipped}
      billingAddress={product.shipped}
      locale="auto"
      allowRememberMe={false}
    />
  );
};

export default PayButton;
