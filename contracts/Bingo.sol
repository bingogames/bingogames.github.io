pragma solidity ^0.4.23;

import "./SafeMath.sol";
import "./Ownable.sol";

// This is Bingo contract.
contract Bingo is Ownable {
	using SafeMath for uint;

	struct Bet{
		address player;
		uint bet_number;
		uint bet_amount;
		uint result_number;
		uint win_amount; 
		uint time;
	}
    mapping(uint => Bet) public bets;

	uint private randomFactor;
	uint private totalUserBets;
	uint private totalUserWin;

	uint public currentBet;
	uint public gameMaxBet;
	uint public gameMinBet;
	uint public profitWinRate;

	event UserBet(address indexed player, uint bet_number, uint bet_amount, uint result_number, uint win_amount, uint id);

	//contract constructor
	constructor() public {
		randomFactor = now.mod(10);
		gameMaxBet = 1000000000;//1000 TRX
		gameMinBet = 1000000;//1 TRX
		profitWinRate = 70;// 1x70 (winner receives x70 of the bet)
	}

	function getRandomFactor() public onlyOwner view returns(uint) {
        return randomFactor;
	}

	function setRandomFactor(uint num) public onlyOwner {
        randomFactor = num;
	}

	function getTotalUserBets() public onlyOwner view returns(uint) {
        return totalUserBets;
	}

	function getTotalUserWin() public onlyOwner view returns(uint) {
        return totalUserWin;
	}


	function setGameMaxBet(uint num) public onlyOwner {
        gameMaxBet = num;
	}

	function setGameMinBet(uint num) public onlyOwner {
        gameMinBet = num;
	}

	function setProfitWinRate(uint num) public onlyOwner {
        profitWinRate = num;
	}

	//userBet
	function userBet(uint bet_number, uint amount) public payable {
		if (msg.value < amount) revert("You not enough TRX provided.");
		if (amount < gameMinBet) revert("You place the bet amount smaller than the minimum amount.");
		if (amount > gameMaxBet) revert("You set the bet amount greater than the maximum amount.");
		if (amount.mul(profitWinRate) > address(this).balance) revert("This contract not enough TRX provided.");
        totalUserBets = totalUserBets.add(amount);
		uint random_number = random_uint();
		randomFactor = randomFactor.add(random_number.mod(10).add(1));
		uint result_number = random_number.mod(100);
		uint win_amount = 0;
		if(result_number == bet_number){
			win_amount = amount.mul(profitWinRate);
			totalUserWin = totalUserWin.add(win_amount);
			msg.sender.transfer(win_amount);
		}
		bets[currentBet] = Bet(
		{
			player: msg.sender,
			bet_number: bet_number,
			bet_amount: amount,
			result_number: result_number,
			win_amount: win_amount,
			time: now
		});
        uint id = currentBet;
		emit UserBet(msg.sender, bet_number, amount, result_number, win_amount, id);
		currentBet++;
	}
	//random_uint
	function random_uint() private view returns (uint256) {
       	return uint256(blockhash(block.number-1-block.timestamp.mod(100))) + randomFactor;
    }

	//withdraw
	function withdraw(uint amount) public onlyOwner {
        require(amount <= address(this).balance);
        owner().transfer(amount);
    }

    function() public payable{}
}
