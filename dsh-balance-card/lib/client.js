/**
 * dsh-balance-card — client bundle.
 *
 * Loader format: `window.__ModuleLoader__.load({id, factory})`. The factory
 * receives the client `require`, which resolves shell-static modules (react,
 * @deepseek-ai/dsh-client-ui-slots, …) and other plugin bundles. The plugin
 * registers a `settings.section` with the lowest order, so the balance card
 * renders at the very top of the Settings page, with a one-click recharge
 * button.
 */
window.__ModuleLoader__.load({
	id: "dsh-balance-card",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const { useEffect, useState } = react;
		const { jsx, jsxs } = require("react/jsx-runtime");

		const RECHARGE_URL = "https://platform.deepseek.com/top_up";
		const CHATGPT_URL = "https://chatgpt.com/";
		const CHATGPT_STATUS_URL = "/ext/chatgpt/status";
		const CHATGPT_QUOTA_URL = "/ext/chatgpt/quota";
		const CURRENCY_SYMBOLS = {
			CNY: "¥",
			USD: "$",
			EUR: "€",
			HKD: "HK$",
			JPY: "¥",
			GBP: "£",
		};

		const name = "dsh-balance-card";
		const inject = ["slots"];

		/** Nav label, localized from the document lang (settings shell has no locale seat for sections). */
		function navLabel() {
			const lang = String(document.documentElement.lang ?? "zh").toLowerCase();
			return lang.startsWith("zh") ? "余额" : "Balance";
		}

		function symbolOf(currency) {
			return CURRENCY_SYMBOLS[currency] ?? (currency ? `${currency} ` : "");
		}

		function money(value) {
			const n = Number(value);
			if (!Number.isFinite(n)) return String(value ?? "—");
			return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		}

		const CSS_TEXT = [
			".dshb-card{display:flex;flex-direction:column;gap:12px;box-sizing:border-box;width:100%;padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}",
			".dshb-head{display:flex;align-items:center;justify-content:space-between;gap:8px}",
			".dshb-title{font-size:13px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-secondary)}",
			".dshb-refresh{flex:none;cursor:pointer;height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:12px;line-height:24px}",
			".dshb-refresh:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dshb-refresh:disabled{opacity:.55;cursor:default}",
			".dshb-amountRow{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}",
			".dshb-amount{font-size:30px;line-height:38px;font-weight:600;letter-spacing:-.5px;font-variant-numeric:tabular-nums}",
			".dshb-currency{font-size:14px;line-height:22px;color:var(--dsw-alias-label-tertiary)}",
			".dshb-chip{flex:none;font-size:11px;line-height:18px;padding:1px 8px;border-radius:999px}",
			".dshb-chip.ok{color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-tertiary)}",
			".dshb-chip.bad{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-mask-1)}",
			".dshb-rows{display:flex;flex-direction:column;gap:6px;padding-top:2px}",
			".dshb-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:12.5px;line-height:18px}",
			".dshb-rowLabel{color:var(--dsw-alias-label-tertiary)}",
			".dshb-rowValue{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:8px}",
			".dshb-chatgptLink{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);text-decoration:none}",
			".dshb-chatgptLink:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}",
			".dshb-chatQuota{display:flex;flex-direction:column;gap:4px;width:100%}",
			".dshb-progress{height:4px;width:100%;overflow:hidden;border-radius:999px;background:var(--dsw-alias-bg-mask-1)}",
			".dshb-progressFill{height:100%;border-radius:999px;background:var(--dsw-alias-state-success-primary)}",
			".dshb-progressFill.warn{background:var(--dsw-alias-state-warn-primary)}",
			".dshb-quotaMeta{font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			".dshb-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:2px}",
			".dshb-recharge{display:inline-flex;align-items:center;justify-content:center;flex:none;height:32px;padding:0 16px;border:none;border-radius:9px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-inverted);text-decoration:none;font-family:inherit;font-size:13px;font-weight:500;line-height:32px;cursor:pointer}",
			".dshb-recharge:hover{background:var(--dsw-alias-button-primary-hover)}",
			".dshb-hint{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
			".dshb-loading,.dshb-error{display:flex;flex-direction:column;align-items:flex-start;gap:10px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);padding:4px 0}",
			".dshb-errorText{white-space:pre-wrap}",
			".dshb-retry{cursor:pointer;height:28px;padding:0 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12.5px;line-height:26px}",
			".dshb-retry:hover{background:var(--dsw-alias-interactive-bg-hover)}",
		].join("");

		/**
		 * The balance card section. Fetches the Host proxy route on mount and
		 * on every refresh; the card is remounted whenever Settings opens, so
		 * the amount is fresh per visit.
		 */
		function BalanceSection() {
			const [attempt, setAttempt] = useState(0);
			const [view, setView] = useState({ status: "loading" });
			const [chat, setChat] = useState(null); // {status, quota}

			useEffect(() => {
				let cancelled = false;
				setView({ status: "loading" });
				fetch("/ext/balance", { headers: { accept: "application/json" } })
					.then((response) => response.json().catch(() => null))
					.then((body) => {
						if (cancelled) return;
						if (body && body.ok === true && body.data) {
							setView({ status: "ready", data: body.data });
						} else {
							setView({ status: "error", code: body?.code, message: body?.message });
						}
					})
					.catch(() => {
						if (!cancelled) setView({ status: "error", code: "network", message: "网络请求失败，请稍后重试。" });
					});
				Promise.all([
					fetch(CHATGPT_STATUS_URL, { headers: { accept: "application/json" } }).then((r) => r.json().catch(() => null)),
					fetch(CHATGPT_QUOTA_URL, { headers: { accept: "application/json" } }).then((r) => r.json().catch(() => null)),
				]).then(([status, quota]) => {
					if (cancelled) return;
					if (status && status.ok === true) {
						setChat({ status, quota: quota && quota.ok === true ? quota : null });
					}
				}).catch(() => { /* keep null */ });
				return () => {
					cancelled = true;
				};
			}, [attempt]);

			useEffect(() => {
				const style = document.createElement("style");
				style.setAttribute("data-dsh-balance-card", "");
				style.textContent = CSS_TEXT;
				document.head.appendChild(style);
				return () => {
					style.remove();
				};
			}, []);

			const refresh = () => setAttempt((n) => n + 1);

			// ChatGPT 额度行
			let chatBody = null;
			if (chat && chat.status) {
				const plan = chat.status.plan ? { plus: "Plus", pro: "Pro", free: "免费" }[chat.status.plan] ?? chat.status.plan : "";
				const cls = chat.quota?.status === "limited" ? "dshb-chip bad" : "dshb-chip ok";
				const remaining = chat.status.loggedIn && typeof chat.quota?.usedPercent === "number"
					? Math.max(0, Math.min(100, 100 - chat.quota.usedPercent))
					: null;
				chatBody = jsxs("div", {
					className: "dshb-chatQuota",
					children: [
						jsxs("div", {
							className: "dshb-row",
							children: [
								jsx("span", { className: "dshb-rowLabel", children: `ChatGPT${plan ? `（${plan}）` : ""}` }),
								jsxs("span", { className: "dshb-rowValue", children: [
									remaining !== null && jsx("span", { className: "dshb-quotaMeta", children: `剩余 ${remaining}%` }),
									jsx("a", { className: "dshb-chatgptLink", href: CHATGPT_URL, target: "_blank", rel: "noopener noreferrer", children: "打开" }),
								] }),
							],
						}),
						remaining !== null && jsx("div", { className: "dshb-progress", children: jsx("div", { className: `dshb-progressFill${cls.includes("bad") ? " warn" : ""}`, style: { width: `${remaining}%` } }) }),
					],
				});
			}

			let body;
			if (view.status === "loading") {
				body = jsx("div", { className: "dshb-loading", children: "正在获取余额…" });
			} else if (view.status === "error") {
				body = jsxs("div", {
					className: "dshb-error",
					children: [
						jsx("div", { className: "dshb-errorText", children: view.message ?? "获取余额失败。" }),
						jsx("button", { type: "button", className: "dshb-retry", onClick: refresh, children: "重试" }),
					],
				});
			} else {
				const data = view.data;
				const info = Array.isArray(data.balance_infos) ? data.balance_infos[0] : undefined;
				if (!info) {
					body = jsxs("div", {
						className: "dshb-error",
						children: [
							jsx("div", { className: "dshb-errorText", children: "暂无余额数据。" }),
							jsx("button", { type: "button", className: "dshb-retry", onClick: refresh, children: "重试" }),
						],
					});
				} else {
					const currency = symbolOf(info.currency);
					const available = data.is_available !== false;
					body = jsxs(react.Fragment, {
						children: [
							jsxs("div", {
								className: "dshb-amountRow",
								children: [
									jsx("span", { className: "dshb-amount", children: `${currency}${money(info.total_balance)}` }),
									jsx("span", { className: available ? "dshb-chip ok" : "dshb-chip bad", children: available ? "可用" : "暂不可用" }),
								],
							}),
							jsxs("div", {
								className: "dshb-rows",
								children: [
									jsxs("div", {
										className: "dshb-row",
										children: [
											jsx("span", { className: "dshb-rowLabel", children: "充值余额" }),
											jsx("span", { className: "dshb-rowValue", children: `${currency}${money(info.topped_up_balance)}` }),
										],
									}),
									jsxs("div", {
										className: "dshb-row",
										children: [
											jsx("span", { className: "dshb-rowLabel", children: "赠送余额" }),
											jsx("span", { className: "dshb-rowValue", children: `${currency}${money(info.granted_balance)}` }),
										],
									}),
									chatBody,
								],
							}),
							jsxs("div", {
								className: "dshb-footer",
								children: [
									jsx("span", { className: "dshb-hint", children: "余额不足会影响对话，建议及时充值" }),
									jsx("a", { className: "dshb-recharge", href: RECHARGE_URL, target: "_blank", rel: "noopener noreferrer", children: "去充值" }),
								],
							}),
						],
					});
				}
			}

			return jsxs("div", {
				className: "dshb-card",
				children: [
					jsxs("div", {
						className: "dshb-head",
						children: [
							jsx("span", { className: "dshb-title", children: "DeepSeek 账户余额" }),
							jsx("button", {
								type: "button",
								className: "dshb-refresh",
								onClick: refresh,
								disabled: view.status === "loading",
								children: "刷新",
							}),
						],
					}),
					body,
				],
			});
		}

		/**
		 * Register the balance section once the `settings.section` slot is
		 * declared (ui-settings owns the declaration; ui-settings-general's
		 * shell sorts sections by `order`, so -100 pins this card to the top).
		 */
		function apply(ctx) {
			// Settings UI is merged into dsh-chatgpt-login's
			// 「供应商余额与额度」 section. Keep this bundle's balance route/logic
			// available for the sidebar and compatibility, but do not add a second
			// settings navigation item.
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	},
});
