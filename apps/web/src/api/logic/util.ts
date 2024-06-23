const isMoreThanOrEqualOneWeek = (time: Date) => {
	const now = new Date();

	const diff = now.getTime() - time.getTime();

	const week = 7 * 24 * 60 * 60 * 1000;

	return diff >= week;
};

export { isMoreThanOrEqualOneWeek };
