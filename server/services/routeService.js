const axios = require("axios");
const deepseek = require("../config/deepseekClient");
const { GOOGLE_ROUTE_API_KEY } = require("../config/apiKeys");

function serviceError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

async function geocode(place) {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: place,
          key: GOOGLE_ROUTE_API_KEY,
        },
      }
    );

    if (!res.data.results.length) return place;

    return res.data.results[0].formatted_address;
  } catch (err) {
    console.log("Geocode失败:", place);
    return place;
  }
}

async function getRoute(userInput) {
  const aiResponse = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: `你是一个地图助手。\
从用户输入中提取起点(from)和终点(to)，\
并转换为 Google Maps 可识别的完整英文地址（必须包含城市和国家）。\
\
返回严格JSON：\
{"from":"...","to":"..."}\
\
规则：\
- 必须英文\
- 尽量具体（街道或知名地点）\
- 不要解释\
\
示例：\
Sky Tower → Sky Tower, Victoria Street West, Auckland Central, Auckland 1010, New Zealand\
University of Auckland → 34 Princes Street, Auckland, New Zealand`,
      },
      { role: "user", content: userInput },
    ],
  });

  console.log("AI解析路线响应:", aiResponse.choices[0].message.content);

  let from;
  let to;

  try {
    const parsed = JSON.parse(aiResponse.choices[0].message.content);
    from = parsed.from;
    to = parsed.to;
  } catch (e) {
    console.log("⚠️ JSON解析失败，使用fallback");

    const parts = userInput.split("到");
    from = parts[0] || userInput;
    to = parts[1] || userInput;
  }

  console.log("路线解析:", from, "→", to);

  const fromAddr = await geocode(from);
  const toAddr = await geocode(to);
  console.log("标准地址:", fromAddr, "→", toAddr);

  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/directions/json",
    {
      params: {
        origin: from,
        destination: to,
        key: GOOGLE_ROUTE_API_KEY,
      },
    }
  );

  if (!response.data.routes.length) {
    throw serviceError("NO_ROUTE_FOUND");
  }

  const route = response.data.routes[0];
  const leg = route.legs[0];

  return {
    from: leg.start_address,
    to: leg.end_address,
    distance: leg.distance.text,
    duration: leg.duration.text,
    polyline: route.overview_polyline.points,
  };
}

module.exports = {
  getRoute,
};
