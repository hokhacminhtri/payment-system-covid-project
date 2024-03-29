const Account = require('../models/account.model');
const { Op, db } = require('../configs/db.config');
const DebtHistory = require('../models/debt-history');
const PaymentLimit = require('../models/payment-limit.model');
const PaymentHistory = require('../models/payment-history.model');

exports.getDebtInfo = async (req, res) => {
	const userId = Number(req.params.userId);
	if (!userId || isNaN(userId)) {
		return res
			.status(400)
			.json({ debtInfo: null, msg: 'userId is required !' });
	}

	try {
		const debtInfo = await DebtHistory.findOne({
			raw: true,
			where: { userId },
			attributes: { exclude: ['accountId', 'userId', 'debtHistoryId'] },
		});
		return res.status(200).json({ debtInfo, msg: 'successfully' });
	} catch (error) {
		console.error('Function getDebtInfo Error: ', error);
		return res.status(500).json({ debtInfo: null, msg: error });
	}
};

exports.getPaymentLimit = async (req, res) => {
	try {
		const paymentLimit = await PaymentLimit.findOne({
			raw: true,
			attributes: { exclude: ['paymentLimitId'] },
		});
		return res.status(200).json({ paymentLimit });
	} catch (error) {
		console.error('Function getPaymentLimit Error: ', error);
		return res.status(500).json({ paymentLimit: null });
	}
};

exports.getUserBalance = async (req, res) => {
	const userId = Number(req.params.userId);

	try {
		const account = await Account.findOne({
			raw: true,
			where: { userId },
			attributes: ['balance'],
		});

		return res.status(200).json({ balance: account?.balance || 0 });
	} catch (error) {
		console.error('Function getUserBalance Error: ', error);
		return res.status(500).json({ balance: 0 });
	}
};

exports.getUserDebtList = async (req, res) => {
	try {
		const debtList = await DebtHistory.findAll({ raw: true });
		return res.status(200).json({ debtList });
	} catch (error) {
		console.error('Function getUserDebtList Error: ', error);
		return res.status(500).json({});
	}
};

exports.postCreateAccount = async (req, res) => {
	const { username, userId } = req.body;

	try {
		if (!username || !userId) {
			throw 'username & userId is required !';
		}

		const isAccountExist = await Account.findOne({
			where: {
				[Op.or]: [{ username }, { userId }],
			},
		});
		if (isAccountExist) {
			throw 'Account already exists !';
		}

		const newAccount = await Account.create({
			username,
			userId,
			password: '',
			balance: 0,
		});

		if (!newAccount) {
			throw 'Account creation failed !';
		}

		return res.status(201).json({ msg: 'Successfully' });
	} catch (error) {
		console.error('Function postCreateAccount Error: ', error);
		return res.status(400).json({ msg: error });
	}
};

exports.putUpdatePaymentLimit = async (req, res) => {
	const newMiniumLimit = Number(req.body.minimumLimit);
	if (isNaN(newMiniumLimit) || newMiniumLimit < 1 || newMiniumLimit > 25) {
		return res.status(400).json({});
	}

	try {
		await PaymentLimit.update(
			{ minimumLimit: newMiniumLimit },
			{ where: { paymentLimitId: 1 } }
		);
		return res.status(200).json({});
	} catch (error) {
		console.error('Function putUpdatePaymentLimit Error: ', error);
		return res.status(400).json({});
	}
};

exports.postPayment = async (req, res) => {
	let { totalMoney, userId } = req.body;
	[totalMoney, userId] = [Number(totalMoney), Number(userId)];
	const tx = await db.transaction();

	try {
		const { balance, accountId } = await Account.findOne({
			raw: true,
			where: { userId },
			attributes: ['balance', 'accountId'],
		});

		const afterBalance = balance - totalMoney > 0 ? balance - totalMoney : 0;
		await PaymentHistory.create(
			{
				transactionCode: Date.now().toString(),
				beforeBalance: balance,
				afterBalance,
				totalMoney,
				createdDate: new Date(),
				content: 'Mua gói nhu yếu phẩm',
				cardNumber: null,
				cardName: null,
				isPutMoney: false,
				accountId,
			},
			{ transaction: tx }
		);
		await Account.update(
			{ balance: afterBalance },
			{ where: { accountId }, transaction: tx }
		);

		await tx.commit();
		return res.status(200).json({ currentBalance: afterBalance });
	} catch (error) {
		await tx.rollback();
		console.error('Function postPayment Error: ', error);
		return res.status(400).json({});
	}
};

exports.postDebt = async (req, res) => {
	let { userId, debt } = req.body;
	[userId, debt] = [userId, debt].map(Number);

	try {
		const debtInfo = await DebtHistory.findOne({
			raw: true,
			where: { userId },
		});

		if (debtInfo) {
			await DebtHistory.update(
				{ debt: debtInfo.debt + debt, updatedDate: new Date() },
				{ where: { userId } }
			);
		} else {
			const account = await Account.findOne({ raw: true, where: { userId } });
			await DebtHistory.create({
				userId,
				debt,
				returned: 0,
				status: 0,
				createdDate: new Date(),
				updatedDate: new Date(),
				accountId: account.accountId,
			});
		}

		return res.status(200).json({});
	} catch (error) {
		console.error('Function postDebt Error: ', error);
		return res.status(500).json({});
	}
};
