// Format string into dd-mm-yyyy with time
export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  });
};

// Format string into time
export const formatTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

// Format ISO string into dd-mm-yyyy
export const formatExpiryDate = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// Format ISO string into dd-mm-yyyy with weekday
export const formatExpiryDateWithWeek = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return `${dd}-${mm}-${yyyy}, on ${days[date.getDay()]}`;
};

// Get minimum difference between consecutive strikes
export const getStrikeRange = (strikeArray = []) => {
  if (!strikeArray || strikeArray.length < 2) return null;
  const sorted = [...strikeArray].sort((a, b) => a - b);
  let minDiff = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    minDiff = Math.min(minDiff, sorted[i] - sorted[i - 1]);
  }
  return minDiff === Infinity ? null : minDiff;
};

// Get Formatted Amount
export const formatAmount = (amount) => {
  if (amount === undefined || amount === null) return '0.00';
   const formatAmount = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `₹ ${formatAmount}`;
};

// Get ATM Strike
export const getATMStrike = (ltp, strikeMultiple) => {
  if (!ltp || !strikeMultiple) return null;
  return Math.round(ltp / strikeMultiple) * strikeMultiple;
};

export const formatDateForComparison = (d) => {
  const dt = new Date(d);

  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getBankNiftyCurrentNextWeek = (expiries, weekday = "Monday") => {

  function makePureDate(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  expiries = expiries
    .map(e => makePureDate(new Date(e)))
    .sort((a, b) => a - b);

  const today = makePureDate(new Date());

  const weekdayNumberMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6
  };

  const targetWeekday = weekdayNumberMap[weekday] ?? 1;

  // Get this week's selected weekday
  function getThisWeekTarget(date) {
    const d = makePureDate(date);
    const currentDay = d.getDay();

    let diff = targetWeekday - currentDay;

    // If target day is ahead → move backward
    if (diff > 0) diff -= 7;

    d.setDate(d.getDate() + diff);
    return makePureDate(d);
  }

  const currentWeekDay = getThisWeekTarget(today);

  const nextWeekDay = makePureDate(
    new Date(
      currentWeekDay.getFullYear(),
      currentWeekDay.getMonth(),
      currentWeekDay.getDate() + 7
    )
  );

  function getThisMonthExpiry(date) {
    return expiries.find(exp => exp >= date);
  }

  function getNextExpiry(currentExp) {
    return expiries.find(exp => exp > currentExp);
  }

  function getAppliedExpiry(forDate) {
    const thisMonthExp = getThisMonthExpiry(forDate);
    const nextMonthExp = getNextExpiry(thisMonthExp);

    if (!thisMonthExp) return null;
    if (!nextMonthExp) return thisMonthExp;

    const expWeekStart = makePureDate(new Date(thisMonthExp));
    expWeekStart.setDate(expWeekStart.getDate() - 1);

    const expWeekEnd = makePureDate(new Date(expWeekStart));
    expWeekEnd.setDate(expWeekEnd.getDate() + 6);

    if (forDate >= expWeekStart && forDate <= expWeekEnd) {
      return nextMonthExp;
    }

    return thisMonthExp;
  }

  return {
    currentWeek: {
      date: currentWeekDay,
      expiry: getAppliedExpiry(currentWeekDay)
    },
    nextWeek: {
      date: nextWeekDay,
      expiry: getAppliedExpiry(nextWeekDay)
    }
  };
};
