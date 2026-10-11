// 日期计算：倒计时、年龄、星座。
// 生日格式：{ year: 2000 | null, month: 1-12, day: 1-31 }；year 为空表示不知道出生年份。
// 所有函数都可以传入 today，方便测试；不传就用今天。
// 只按"本地日期"计算，不涉及时分秒，避免时区和夏令时问题。

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(month, year) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// Date → { year, month, day }（本地日期）
export function toYMD(date = new Date()) {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

// "2025-03-14" ⇄ { year, month, day }
export function parseISODate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || "");
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function toISODate(ymd) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${ymd.year}-${pad(ymd.month)}-${pad(ymd.day)}`;
}

export function todayISO(today = new Date()) {
  return toISODate(toYMD(today));
}

// 两个日期相差几天（b - a）
export function diffDays(a, b) {
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86400000);
}

function compareYMD(a, b) {
  return diffDays(b, a); // > 0 表示 a 在 b 之后
}

// 某一年里的生日。2 月 29 日出生、当年不是闰年 → 按 2 月 28 日
export function birthdayInYear(month, day, year) {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return { year, month: 2, day: 28 };
  }
  return { year, month, day };
}

// 下一次生日：{ date, daysUntil, turningAge }
// 今天就是生日时 daysUntil = 0；不知道出生年份时 turningAge = null
export function nextBirthday(birthday, today = new Date()) {
  const t = toYMD(today);
  let year = t.year;
  let date = birthdayInYear(birthday.month, birthday.day, year);
  if (compareYMD(date, t) < 0) {
    year += 1;
    date = birthdayInYear(birthday.month, birthday.day, year);
  }
  return {
    date,
    daysUntil: diffDays(t, date),
    turningAge: birthday.year ? year - birthday.year : null,
  };
}

// 现在几岁；不知道出生年份时返回 null
export function getAge(birthday, today = new Date()) {
  if (!birthday.year) return null;
  const t = toYMD(today);
  const thisYear = birthdayInYear(birthday.month, birthday.day, t.year);
  let age = t.year - birthday.year;
  if (compareYMD(t, thisYear) < 0) age -= 1;
  return age;
}

// 星座分界（每个星座的开始日期）
const ZODIAC_STARTS = [
  [1, 20, "水瓶座"], [2, 19, "双鱼座"], [3, 21, "白羊座"], [4, 20, "金牛座"],
  [5, 21, "双子座"], [6, 22, "巨蟹座"], [7, 23, "狮子座"], [8, 23, "处女座"],
  [9, 23, "天秤座"], [10, 24, "天蝎座"], [11, 23, "射手座"], [12, 22, "摩羯座"],
];

export function getZodiac({ month, day }) {
  let sign = "摩羯座"; // 1 月 1 日 – 1 月 19 日
  for (const [m, d, name] of ZODIAC_STARTS) {
    if (month > m || (month === m && day >= d)) sign = name;
  }
  return sign;
}

// 检查生日是否合法；合法返回 null，否则返回中文错误提示
export function validateBirthday(birthday, today = new Date()) {
  const { year, month, day } = birthday || {};
  const t = toYMD(today);

  if (!Number.isInteger(month) || month < 1 || month > 12) return "请选择月份";
  if (year != null && (!Number.isInteger(year) || year < 1900 || year > t.year)) {
    return "出生年份不太对";
  }
  // 不知道年份时允许 2 月 29 日
  const maxDay = daysInMonth(month, year ?? 2000);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return "这个月没有这一天";
  if (year != null && compareYMD({ year, month, day }, t) > 0) return "生日不能晚于今天";
  return null;
}

// 显示用："2000年3月14日" 或 "3月14日"
export function formatBirthday(birthday) {
  const md = `${birthday.month}月${birthday.day}日`;
  return birthday.year ? `${birthday.year}年${md}` : md;
}

// 所有人按"下一次生日"从近到远排序
// 返回 [{ person, date, daysUntil, turningAge }]
export function sortByNextBirthday(people, today = new Date()) {
  return people
    .map((person) => ({ person, ...nextBirthday(person.birthday, today) }))
    .sort((a, b) => a.daysUntil - b.daysUntil || a.person.name.localeCompare(b.person.name, "zh"));
}
