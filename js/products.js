// Task D owns this file: 03_FEATURE_SPEC.md 상품 예시 데이터

export const products = [
  {
    id: "todak-parking",
    name: "토닥 파킹통장",
    bankName: "토닥은행",
    type: "자유입출금",
    term: null,
    rate: 0.031,
    instantWithdraw: true,
    note: "중도 출금 가능",
  },
  {
    id: "saerok-short-term",
    name: "6개월 단기적금",
    bankName: "새록저축은행",
    type: "단기적금",
    term: "6개월",
    rate: 0.045,
    instantWithdraw: false,
  },
  {
    id: "pureun-free-savings",
    name: "자유적금 12M",
    bankName: "푸른은행",
    type: "정기적금",
    term: "12개월",
    rate: 0.04,
    instantWithdraw: false,
  },
];
