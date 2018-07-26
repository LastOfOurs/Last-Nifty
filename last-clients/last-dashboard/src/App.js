import React, { Component } from 'react';
import './App.css';
import 'materialize-css';
import 'materialize-css/dist/css/materialize.min.css';
import Notifications, {notify} from 'react-notify-toast';
import fetch from 'node-fetch';
import PlasmaConfig from './config'
import tiger from './Malayan_Tiger_Adult.png';
import wwf from './panda-wwf-logo.jpg'
import rainforest from './raiforest.jpeg'
import wcs from './WCS_Logo_SS.png'
var Web3 = require('web3');
var web3 = window.web3



if (typeof web3 !== 'undefined') {
  var web3 = new Web3(web3.currentProvider);
  console.log("got web3 ")
} else {
  // set the provider you want from Web3.providers
  var web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
  console.log("dont have web3")
}

console.log(PlasmaConfig.abi)
console.log(PlasmaConfig.address)

let PlasmaContract = web3.eth.contract(PlasmaConfig.abi)
let Plasma = PlasmaContract.at(PlasmaConfig.address)

class App extends Component {
  constructor(props){
    super(props)
    this.state = {
      "AnimalId": " ",
      "AnimalName": " ",
      "AnimalCommonName": " ",
      "AnimalScienceName": " ",
      "AnimalHabitat": " ",
      "RecipientAddress": "0x3b0ba3134ac12cc065d4dba498a60cba5ef16098",
      "DonerAddress": "0x87dbd8Ab1Bd9d4FCE07DB12743594a5f456435ff",
      "DonerEth": " ",
      "DonationAmount": " ",
      "DonorMainnetEth": " ",
      "LastIPFS": "https://ipfs.io/ipfs/Qmbf8qJfYJETG6udpm33Lw6BkM2jVaLwHxLTzmXspQXnb8",
      "fundingAmount": " "
    }
    this.getUtxo = this.getUtxo.bind(this)
    this.mineNewBlock = this.mineNewBlock.bind(this)
    this.sendTransaction = this.sendTransaction.bind(this)
    this.retrieveData = this.retrieveData.bind(this)
    this.getMainnetBalance = this.getMainnetBalance.bind(this)
    this.depositEth = this.depositEth.bind(this)
    this.signTransaction = this.signTransaction.bind(this)
  }

  componentDidMount(){

    this.getUtxo()
    this.retrieveData()
    this.getMainnetBalance()
    var Web3 = require('web3');
    var web3 = window.web3
    if (typeof web3 !== 'undefined') {
      var web3 = new Web3(web3.currentProvider);
      console.log("got web3 ")
    } else {
      // set the provider you want from Web3.providers
      var web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
      console.log("dont have web3")
    }
  }

  retrieveData(){
    fetch('https://ipfs.io/ipfs/Qmbv9SiprxoS1AXWA6HqeSeY2MYyrNWCSiN6dGUSsKJ61j')
      .then(res => res.json())
      .then(body => {
        console.log(body.animals[0])
        this.setState({
          "AnimalId": body.animals[0].id,
          "AnimalName": body.animals[0].name,
          "AnimalCommonName": body.animals[0].commonName,
          "AnimalScienceName": body.animals[0].scientificName,
          "AnimalHabitat": body.animals[0].habitat,
        })
      })
  }
  async getMainnetBalance(){
    web3.eth.getBalance("0x87dbd8ab1bd9d4fce07db12743594a5f456435ff", (err, res)=> {
      this.setState({
        "DonorMainnetEth": web3.fromWei(res.toString(), "ether")
      })
    })
  }
  
  getUtxo(){
    fetch('http://localhost:3001/utxo')
    .then(res => res.json())
    .then(body => {
      for(let i = 0; i < body.length; i ++){
        if(body[i].owner == this.state.DonerAddress){
          //console.log(body[i].denom)
          this.setState({
            "DonerEth" : web3.fromWei(body[i].denom.toString(), 'ether')
          }) 
        } else if (body[i].owner == this.state.RecipientAddress){
          this.setState({
            "fundingAmount" : web3.fromWei(body[i].denom.toString(), 'ether') + " ETH"
          })
        }
      }
    })
  }


  mineNewBlock(){
    console.log("Mining new Block")
    fetch('http://localhost:3001/mineBlock' , { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }  
    })
  }

  async sendTransaction(){
    console.log("sending transaction")
    await fetch('http://localhost:3001/transact' , { 
      method: 'POST',
      body: `{
        "from": "0x87dbd8Ab1Bd9d4FCE07DB12743594a5f456435ff", 
        "to": "0x3b0ba3134ac12cc065d4dba498a60cba5ef16098", 
        "amount": 3
      }`,
      headers: { 'Content-Type': 'application/json' }  
    })
    await this.mineNewBlock()
    setInterval(()=>{ this.getUtxo() }, 500)
    notify.show('Transaction Made on Plasma', "success")
  }

  /*
  async depositEth(){
    console.log("sending transaction")
    await fetch('http://localhost:3001/deposit' , { 
      method: 'POST',
      body: `{
        "address": "0x87dbd8Ab1Bd9d4FCE07DB12743594a5f456435ff", 
        "amount": 0.3
      }`,
      headers: { 'Content-Type': 'application/json' }  
    })
    await this.mineNewBlock()
    setInterval(()=>{ this.getUtxo() }, 400);
  }
  */
 async depositEth(){
  await Plasma.deposit({
    from: web3.eth.accounts[0], value: 5000000000000000000, gas: 300000
  }, (err, res)=> {
    console.log(res)
    this.mineNewBlock()
    setInterval(()=>{ this.getUtxo() }, 400);
    notify.show('ETH Deposited to Plasma', "success")
  });
  
}



  async signTransaction(){
    web3.personal.sign(web3.fromUtf8(this.state.RecipientAddress), web3.eth.coinbase, (err, res)=> {
      console.log(res)
      this.sendTransaction()
    });
  }

  notification(info){
    console.log(`new notification ${info}`)
  }

  render() {
    
    return (
      <div className="container">
        <div className ="row">
          <div className="col s6"><img className=" responsive-img" src={tiger} />
          </div>
          <div className="card col s6">
            <h5>Animal ID:</h5>
            {this.state.AnimalId}
            <h5>Animal Name:</h5>
            {this.state.AnimalName}
            <h5>Animal Common name:</h5>
            {this.state.AnimalCommonName}
            <h5>Animal Science name:</h5>
            {this.state.AnimalScienceName}
            <h5>Habitat:</h5>
            {this.state.AnimalHabitat}
          </div>
        </div>
        <div className="row">
          <h5>Non-profit Animal Funds</h5>
          <div className="card col s3">
          
            <h4>WWF Fund:</h4>
            <h5>{this.state.fundingAmount}</h5>
          </div>
          <div className="card col s3">
            <h4>WCS Fund:</h4>
            <h5>{this.state.fundingAmount}</h5>
          </div>
          <div className="card col s3">
            <h4>WildLife Act</h4>
            <h5>{this.state.fundingAmount}</h5>
          </div>
        </div>
        
        <div className="row">
          <div className="col s6">
            <h5>Your Plasma Balance</h5>
            {this.state.DonerEth + " ETH"}
          </div>
          <div className="col s6">
            <h5>Your Mainnet Balance</h5>
            {this.state.DonorMainnetEth + " ETH"}
          </div>
        </div>
        <div class="row">
          <form class="col s12">
            <div class="row">
              <div class="input-field col s6">
                <input id="email" type="email" class="validate"/>
                <label for="email">Amount of ETH to Donate</label>
                <a onClick={this.signTransaction} class="waves-effect waves-light btn">Donate ETH</a>
              </div>
              <div class="input-field col s6">
                <input id="topup" type="email" class="validate"/>
                <label for="topup">Deposit ETH on Plasma</label>
                <a onClick={this.depositEth} class="waves-effect waves-light btn">Top-up ETH on Plasma</a>
              </div>
            </div>
          </form>
        </div>
        <div className='main'>
              <Notifications />
             </div>
      </div>
    );
  }
}

export default App;