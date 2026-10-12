// 示例数据：4 个虚构的朋友和家人 + 送礼记录。
// 生日按"今天"往后推算，保证首页一打开就能看到大蛋（今天、2 天后）和小蛋（12 天后）。
import { toYMD, toISODate } from "./dates.js";

// 今天往后 n 天的 { year, month, day }（避开 2 月 29 日，免得非闰年显示成 2 月 28 日）
function daysFromNow(n, today) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
  const ymd = toYMD(d);
  if (ymd.month === 2 && ymd.day === 29) ymd.day = 28;
  return ymd;
}

// 某人 yearsAgo 年前那次生日的日期，作为礼物日期
function pastBirthday(birthday, yearsAgo, today) {
  return toISODate({ year: today.getFullYear() - yearsAgo, month: birthday.month, day: birthday.day });
}

export function buildSampleData(today = new Date()) {
  const thisYear = today.getFullYear();
  // n 天后过生日；age 是"这次生日满几岁"，用来倒推出生年份；null 表示年份不详
  const b = (n, age) => {
    const next = daysFromNow(n, today);
    return { year: age == null ? null : next.year - age, month: next.month, day: next.day };
  };

  const momo = { key: "momo", name: "小桃", category: "friend", birthday: b(0, 25), eggColor: "#F7B8CB",
    tags: ["芭蕾风", "Jellycat", "草莓", "胶片相机"] };
  const lily = { key: "lily", name: "Lily", category: "friend", birthday: b(2, null), eggColor: "#BFEBDD",
    tags: ["手冲咖啡", "绿植", "极简风"] };
  const mom = { key: "mom", name: "妈妈", category: "family", birthday: b(12, 56), eggColor: "#FFD3BA",
    tags: ["养花", "丝巾", "太极", "不喜欢浪费钱"] };
  const kai = { key: "kai", name: "阿凯", category: "friend", birthday: b(60, 27), eggColor: "#C9E6F7",
    tags: ["滑雪", "任天堂", "精酿啤酒"] };

  const gifts = [
    { personKey: "momo", name: "芭蕾舞鞋挂件", category: "饰品", occasion: "生日",
      date: pastBirthday(momo.birthday, 1, today), reaction: "超喜欢，第二天就挂在包上了" },
    { personKey: "momo", name: "Jellycat 小兔玩偶", category: "玩偶", occasion: "生日",
      date: pastBirthday(momo.birthday, 2, today), reaction: "每天抱着睡觉" },
    { personKey: "lily", name: "手冲咖啡壶", category: "家居", occasion: "生日",
      date: pastBirthday(lily.birthday, 1, today), reaction: "说每天早上都在用" },
    { personKey: "mom", name: "真丝丝巾", category: "服饰", occasion: "生日",
      date: pastBirthday(mom.birthday, 1, today), reaction: "很喜欢颜色，但觉得太贵了" },
    { personKey: "kai", name: "滑雪手套", category: "服饰", occasion: "圣诞节",
      date: toISODate({ year: thisYear - 1, month: 12, day: 25 }), reaction: "" },
  ];

  return { people: [momo, lily, mom, kai], gifts };
}
