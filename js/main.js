//
var FOUNDATION_ADDRESS = 'TWiWt5SEDzaEqS6kE5gandWMNfxR2B5xzg';
var game_totalBet = 0;
var profit_WinRate = 0;
var game_MaxBet = 0;
var game_MaxBet_new = 0;
var game_MaxBet_newTRX = 0;
var contract_address = "";
var contract_network = "mainnet";
//
var state = {tronWeb:{}};
this.setState = function(st){
	state.tronWeb = st.tronWeb; //alert(state.tronWeb.installed+" - "+state.tronWeb.loggedIn);
	if(window.tronLinkTimer){
		if(state.tronWeb.loggedIn)tronLinkHandle();
	} else{
		tronLinkHandle();
	}
}
async function componentDidMount() {
	await new Promise(resolve => {
		const tronWebState = {
			installed: !!window.tronWeb,
			loggedIn: window.tronWeb && window.tronWeb.ready
		};

		if(tronWebState.installed) {
			this.setState({
				tronWeb:
				tronWebState
			});
			return resolve();
		}
		//
		let tries = 0;
		const timer = setInterval(() => {
			if(tries >= 10) {
				//const TRONGRID_API = 'https://api.trongrid.io';
				if(contract_network == "mainnet"){
					var fullNode_API = 'https://api.trongrid.io';
					var solidityNode_API = fullNode_API;
					var eventServer_API = fullNode_API+"/";
				} else if(contract_network == "testnet"){
					var fullNode_API = 'https://api.shasta.trongrid.io';
					var solidityNode_API = fullNode_API;
					var eventServer_API = fullNode_API;
				} else{
					var fullNode_API = 'http://127.0.0.1:8090';
					var solidityNode_API = 'http://127.0.0.1:8091';
					var eventServer_API = 'http://127.0.0.1:8092';
				}
				
				const HttpProvider = TronWeb.providers.HttpProvider;
				const fullNode = new HttpProvider(fullNode_API);
				const solidityNode = new HttpProvider(solidityNode_API);
				const eventServer = eventServer_API;
				window.tronWeb = new TronWeb(
					fullNode,
					solidityNode,
					eventServer_API
				);

				this.setState({
					tronWeb: {
						installed: false,
						loggedIn: false
					}
				});
				clearInterval(timer);
				return resolve();
			}
			//
			tronWebState.installed = !!window.tronWeb;
			tronWebState.loggedIn = window.tronWeb && window.tronWeb.ready;

			if(!tronWebState.installed)return tries++;

			this.setState({
				tronWeb: tronWebState
			});

			resolve();
		}, 100);
	});

	if(!state.tronWeb.loggedIn) {
		// Set default address (foundation address) used for contract calls
		// Directly overwrites the address object as TronLink disabled the
		window.tronWeb.defaultAddress = {
			hex: window.tronWeb.address.toHex(FOUNDATION_ADDRESS),
			base58: FOUNDATION_ADDRESS
		};
	}

	window.tronWeb.on('addressChanged', (address) => {//console.log('addressChanged:'+address.base58)
		if(state.tronWeb.loggedIn)return;
		this.setState({
			tronWeb: {
				installed: true,
				loggedIn: true
			}
		});
	});
	//window.tronWeb.on('privateKeyChanged', (address) => {console.log('privateKeyChanged:'+address)});
	
	//contract = tronWeb.contract(contracts.abi, contracts.networks["*"].address);
	await $.getJSON("Bingo.json", function(contracts) {
		contract_address = contracts.networks["*"].address;
		console.log("contract_address: "+tronWeb.address.fromHex(contract_address))
		contract = tronWeb.contract(contracts.abi, contract_address);
		var base58 = tronWeb.address.fromHex(contract_address);
		$("#contractaddresslink").html('Contract address: <a target="_blank" href="https://tronscan.org/#/contract/'+base58+'" >'+base58+'</a>');
		initGame();
	}).fail(function() {
		console.log( "get contract error" );
	})
	
	
    //this.fetchMessages();
}

//
function transformData(message) {
	return {
		player: message.player,
		bet_number: message.bet_number.toNumber(),//toNumber function of TronWeb
		bet_amount: message.bet_amount.toNumber(),
		result_number: message.result_number.toNumber(),
		win_amount: message.win_amount.toNumber(),
		time: message.time.toNumber()
	}
}

//
async function initGame() {
	await getProfitWinRate();
	await getGameMaxBet();
	await getBalanceContract();
	//
	contract.UserBet().watch((err, { result }) => {
		if(err)return console.error('Failed to bind event listener:', err);
		if(window.timer)clearTimeout(timer);
		timer = setTimeout(function(){getBalanceContract();}, 2000);
		//console.log('Detected new message:', result.id);
		//console.log('message:', JSON.stringify(result));
		var id = Number(result.id);
		if(id < game_totalBet)return;
		game_totalBet = id+1;
		if(result.player == tronWeb.defaultAddress.hex){
			addRecentData(result, true);
		} else{
			addAllBetData(result);
		}
	});
	

	const totalBet = (await contract.currentBet().call()).toNumber();
	game_totalBet = totalBet;
	const min = Math.min(totalBet, 10);//console.log("totalBet: "+totalBet);
	const totalBetIDs = [];
	for(var i = totalBet-min; i < totalBet; i++)totalBetIDs.push(i);
	
	await Promise.all(totalBetIDs.map(betID => (
		contract.bets(betID).call()
	))).then(totalBets => totalBets.forEach((bet, index) => {
		bet = transformData(bet);
		if(bet.player == tronWeb.defaultAddress.hex){
			addRecentData(bet);
		} else{
			addAllBetData(bet);
		}
	}));
}



function userBetSend() {
	if(window.betNumber == undefined){
		alert("Please select the number to bet!");
		return;
	}
	var amount = parseFloat($("#amount").val());
	if(!amount){
		$("#amount").val("");
		alert("Please enter the amount to bet!");
		return;
	}
	if(amount < 1){
		alert("Minimum bet is 1 TRX");
		return;
	}
	if(game_MaxBet_newTRX && amount > game_MaxBet_newTRX){
		alert("Maximum bet is "+game_MaxBet_newTRX+" TRX");
		return;
	}
	//waitingDialog.show('');
	var sun = tronWeb.toSun(amount); //alert(betNumber+" - "+amount+" - "+sun);//return;
	contract.userBet(betNumber, sun).send({
		callValue: sun
		//shouldPollResponse: true
	}).then(function(r) {
		setTimeout(function(){watchAllBet();},2000);
	    //console.log("userBet: "+JSON.stringify(r));
	}).catch(function(e) {
	    //console.log("userBet: "+e);
	});
}

function getProfitWinRate() {
	contract.profitWinRate().call().then(function(r) {
		profit_WinRate = r;
	    console.log("profitWinRate: "+r);
	}).catch(function(e) {
	    console.log("profitWinRate: "+e);
	});
}

function getGameMinBet() {
	contract.gameMinBet().call().then(function(r) {
	    console.log("gameMinBet: "+r);
	}).catch(function(e) {
	    console.log("gameMinBet: "+e);
	});
}

function getGameMaxBet() {
	contract.gameMaxBet().call().then(function(r) {
		game_MaxBet = r;
	    console.log("gameMaxBet: "+r);
	}).catch(function(e) {
	    console.log("gameMaxBet: "+e);
	});
}

function getBalanceContract() {
	tronWeb.trx.getBalance(tronWeb.address.fromHex(contract_address)).then(function(r) {
		if(profit_WinRate && r)game_MaxBet_new = Math.floor(r/profit_WinRate);
		if(game_MaxBet && game_MaxBet_new > game_MaxBet)game_MaxBet_new = game_MaxBet;
		if(game_MaxBet_new)game_MaxBet_newTRX = Number(tronWeb.fromSun(game_MaxBet_new)).toFixed(2);
		$("#bingo-max-bet").html("Maximum bet: "+game_MaxBet_newTRX+" TRX");
	    //console.log("getBalance: "+r);
	}).catch(function(e) {
	    console.log("getBalance: "+e);
	});
}

async function watchAllBet() {
	const currentBet = (await contract.currentBet().call()).toNumber();
	if(currentBet <= game_totalBet)return;
	const nextbet = Math.max(currentBet-10, game_totalBet);
	//console.log("currentBet: "+currentBet+", nextbet: "+nextbet);
	game_totalBet = currentBet;
	const totalBetIDs = [];
	for(var i = nextbet; i < game_totalBet; i++)totalBetIDs.push(i);
	await Promise.all(totalBetIDs.map(betID => (
		contract.bets(betID).call()
	))).then(totalBets => totalBets.forEach((bet, index) => {
		bet = transformData(bet);
		//console.log('watchAllBet:', JSON.stringify(bet));
		if(bet.player == tronWeb.defaultAddress.hex){
			addRecentData(bet, true);
		} else{
			addAllBetData(bet);
		}
	}));
}

function getCurrentBet() {
	contract.currentBet().call().then(function(r) {
	    console.log("currentBet: "+r);
	}).catch(function(e) {
	    console.log("currentBet: "+e);
	});
}

function getBetData() {
	var bet = $("#betid").val();
	contract.bets(bet).call().then(function(r) {
	    console.log("bets: "+JSON.stringify(transformData(r)));
	}).catch(function(e) {
	    console.log("bets: "+e);
	});
}

//
function getRandomFactor() {
	contract.getRandomFactor().call().then(function(r) {
	    console.log("getRandomFactor: "+r);
	}).catch(function(e) {
	    console.log("getRandomFactor: "+e);
	});
}
function getTotalUserBets() {
	contract.getTotalUserBets().call().then(function(r) {
	    console.log("getTotalUserBets: "+r);
	}).catch(function(e) {
	    console.log("getTotalUserBets: "+e);
	});
}
function getTotalUserWin() {
	contract.getTotalUserWin().call().then(function(r) {
	    console.log("getTotalUserWin: "+r);
	}).catch(function(e) {
	    console.log("getTotalUserWin: "+e);
	});
}

//
function bingo_select(i){
	window.betNumber = i;
	$(".btn-bingo").removeClass("btn-danger");
	$("#btn-bingo"+i).removeClass("btn-light");
	$("#btn-bingo"+i).addClass("btn-danger");
	$("#bingo-bet-number").html(i);
}

function amountChang(){
	var amount = parseFloat($("#amount").val());//console.log("amount:"+amount)
	if(!amount){
		$("#amount").val("");
		amount = 0;
	}
	$("#bingo-profit-win").html("Profit on win: "+(amount*70)+ " TRX");
}
function gg(){
	addAllBetData({"result_number":"11","bet_number":"58","bet_amount":"1000000","win_amount":"0","id":"123","player":"TNHpUuakVeceLagF9k6j8HU9KruSQ23cXW"})
}
//
function addRecentData(data, watchE){
	const player = tronWeb.address.fromHex(data.player);
	const bet_number = data.bet_number;
	const bet_amount = tronWeb.fromSun(data.bet_amount);
	const result_number = data.result_number;
	const win_amount = tronWeb.fromSun(data.win_amount);
	if(watchE){
		$("#bet-modal-body").html("<p>Bet number: "+bet_number+"</p><p>Bet amount: "+bet_amount+" TRX</p><p>Result number: "+result_number+"</p><p>Win amount: "+win_amount+" TRX</p>");
		$("#mybetModal").modal("show");
	}
	//
	var html = '<div class="message-bet"><span class="owner">'+player+'</span> Bet number: <b>'+bet_number+'</b>, Bet amount: <b>'+bet_amount+' TRX</b>, Result number: <b>'+result_number+'</b>, Win amount: <b>'+win_amount+' TRX</b></div>';
	if($("#recent-bets .message-bet").length){
		$(html).insertBefore($("#recent-bets .message-bet")[0]);
	} else{
		$("#recent-bets").html(html);
	}
	while ($("#recent-bets .message-bet").length > 10){
		$("#recent-bets .message-bet").last().remove();
	}
}

//
function addAllBetData(data){
	const player = tronWeb.address.fromHex(data.player);
	const bet_number = data.bet_number;
	const bet_amount = tronWeb.fromSun(data.bet_amount);
	const result_number = data.result_number;
	const win_amount = tronWeb.fromSun(data.win_amount);
	//
	var html = '<div class="message-bet"><span class="owner">'+player+'</span> Bet number: <b>'+bet_number+'</b>, Bet amount: <b>'+bet_amount+' TRX</b>, Result number: <b>'+result_number+'</b>, Win amount: <b>'+win_amount+' TRX</b></div>';
	if($("#all-bets .message-bet").length){
		$(html).insertBefore($("#all-bets .message-bet")[0]);
	} else{
		$("#all-bets").html(html);
	}
	while ($("#all-bets .message-bet").length > 10){
		$("#all-bets .message-bet").last().remove();
	}
}

//
$( document ).ready(function() {
	$("#bingo-button-group").html("");
	for(var i = 0; i <= 99; i++){
		var k = i;
		if(i < 10)k = '0'+i;
		$("#bingo-button-group").append('<button type="button" id="btn-bingo'+i+'" onclick="bingo_select('+i+')" class="btn btn-light btn-bingo">'+k+'</button> ');
	}
	$("#tronLink-install").hide();
	$("#tronLink-login").hide();
	tronLinkTimer = setTimeout(function(){tronLinkHandle()},2000);
	//
});

window.onload = function(){
	componentDidMount();
}

function tronLinkHandle(){
	if(state.tronWeb.loggedIn){
		$("#tronLink-install").hide();
		$("#tronLink-login").hide();
		$('#btn-bet').prop("disabled", false);
	} else{
		$('#btn-bet').prop("disabled", true);
		if(state.tronWeb.installed){
			$("#tronLink-login").show();
		} else{
			$("#tronLink-install").show();
		}
	}
	if(window.tronLinkTimer){
		clearTimeout(tronLinkTimer);
		tronLinkTimer = null;
	}
}

var waitingDialog = waitingDialog || (function ($) {
    'use strict';
	// Creating modal dialog's DOM
	var $dialog = $(
		'<div class="modal fade" data-backdrop="static" data-keyboard="false" tabindex="-1" role="dialog" aria-hidden="true" style="padding-top:15%; overflow-y:visible;">' +
		'<div class="modal-dialog modal-m">' +
		'<div class="modal-content">' +
			'<div class="modal-header"><h3 style="margin:0;"></h3></div>' +
			'<div class="modal-body">' +
				'<div class="progress progress-striped active" style="margin-bottom:0;"><div class="progress-bar" style="width: 100%"></div></div>' +
			'</div>' +
		'</div></div></div>');

	return {
		/**
		 * Opens our dialog
		 * @param message Custom message
		 * @param options Custom options:
		 * 				  options.dialogSize - bootstrap postfix for dialog size, e.g. "sm", "m";
		 * 				  options.progressType - bootstrap postfix for progress bar type, e.g. "success", "warning".
		 */
		show: function (message, options) {
			// Assigning defaults
			if (typeof options === 'undefined') {
				options = {};
			}
			if (typeof message === 'undefined') {
				message = 'Loading';
			}
			var settings = $.extend({
				dialogSize: 'm',
				progressType: '',
				onHide: null // This callback runs after the dialog was hidden
			}, options);

			// Configuring dialog
			$dialog.find('.modal-dialog').attr('class', 'modal-dialog').addClass('modal-' + settings.dialogSize);
			$dialog.find('.progress-bar').attr('class', 'progress-bar');
			if (settings.progressType) {
				$dialog.find('.progress-bar').addClass('progress-bar-' + settings.progressType);
			}
			$dialog.find('h3').text(message);
			// Adding callbacks
			if (typeof settings.onHide === 'function') {
				$dialog.off('hidden.bs.modal').on('hidden.bs.modal', function (e) {
					settings.onHide.call($dialog);
				});
			}
			// Opening dialog
			$dialog.modal();
		},
		/**
		 * Closes dialog
		 */
		hide: function () {
			$dialog.modal('hide');
		}
	};

})(jQuery);