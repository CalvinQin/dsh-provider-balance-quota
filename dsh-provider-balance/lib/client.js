/**
 * dsh-chatgpt-login — client bundle.
 *
 * 1. 侧边栏组件（sidebar.footer.action，位于设置按钮上方）：紧凑展示
 *    DeepSeek 余额 + ChatGPT 登录状态/额度，一键充值/打开。
 * 2. 设置页 ChatGPT 卡片：账号来源（CodexManager 同步 / 手动授权）、套餐、
 *    额度状态、备用授权登录流、退出登录。
 * 3. 全部使用语义化主题变量（修复浅色/深色主题下的字体颜色问题）。
 */
window.__ModuleLoader__.load({
	id: "dsh-provider-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const { useEffect, useState } = react;
		const { jsx, jsxs } = require("react/jsx-runtime");

		const CHATGPT_URL = "https://chatgpt.com/";
		const RECHARGE_URL = "https://platform.deepseek.com/top_up";
		const STATUS_URL = "/ext/chatgpt/status";
		const QUOTA_URL = "/ext/chatgpt/quota";
		const BALANCE_URL = "/ext/balance";
		const LOGIN_START_URL = "/ext/chatgpt/login/start";
		const LOGIN_STATUS_URL = "/ext/chatgpt/login/status";
		const LOGOUT_URL = "/ext/chatgpt/logout";
		const MANAGER_OPEN_URL = "/ext/chatgpt/login/open-manager";
		const CHOOSE_ACCOUNT_URL = "https://auth.openai.com/choose-an-account";

		const name = "dsh-provider-balance";
		const inject = ["slots"];

		/** 修复后的通用样式：语义化变量，浅色/深色主题均可用。 */
		const CSS_TEXT = [
			// ── 通用卡片 ──
			".dshg-card{display:flex;flex-direction:column;gap:12px;box-sizing:border-box;width:100%;padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}",
			".dshg-head{display:flex;align-items:center;justify-content:space-between;gap:8px}",
			".dshg-title{font-size:13px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-secondary)}",
			".dshg-statusRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".dshg-status{font-size:15px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary)}",
			".dshg-chip{font-size:11px;line-height:18px;padding:1px 8px;border-radius:999px}",
			".dshg-chip.on{color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-tertiary)}",
			".dshg-chip.off{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-mask-1)}",
			".dshg-chip.warn{color:var(--dsw-alias-state-warn-primary);background:var(--dsw-alias-state-warn-tertiary)}",
			".dshg-sub{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary)}",
			".dshg-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".dshg-primary{display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 16px;border:none;border-radius:9px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-inverted);text-decoration:none;font-family:inherit;font-size:13px;font-weight:500;line-height:32px;cursor:pointer}",
			".dshg-primary:hover{background:var(--dsw-alias-button-primary-hover)}",
			".dshg-primary:disabled{opacity:.55;cursor:default}",
			".dshg-ghost{cursor:pointer;height:32px;padding:0 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:30px}",
			".dshg-ghost:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshg-ghost.danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}",
			".dshg-refresh{cursor:pointer;height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:12px;line-height:24px}",
			".dshg-refresh:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dshg-refresh:disabled{opacity:.55;cursor:default}",
			".dshg-flow{display:flex;flex-direction:column;gap:10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}",
			".dshg-code{font-family:var(--ds-font-family-code, monospace);font-size:24px;line-height:32px;font-weight:600;letter-spacing:4px;text-align:center;color:var(--dsw-alias-label-primary)}",
			".dshg-hint{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary)}",
			".dshg-msg{font-size:12px;line-height:18px}",
			".dshg-msg.ok{color:var(--dsw-alias-state-success-primary)}",
			".dshg-msg.bad{color:var(--dsw-alias-state-error-primary)}",
			".dshg-loading{font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}",
			".dshg-provider{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}",
			".dshg-providerHead{display:flex;align-items:baseline;justify-content:space-between;gap:10px}",
			".dshg-providerTitle{font-size:14px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary)}",
			".dshg-balanceAmount{font-size:25px;line-height:32px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}",
			".dshg-detailRows{display:flex;flex-direction:column;gap:5px}",
			".dshg-detailRow{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:12.5px;line-height:18px}",
			".dshg-detailLabel{color:var(--dsw-alias-label-tertiary)}",
			".dshg-detailValue{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}",
			".dshg-providerActions{display:flex;align-items:center;justify-content:flex-end;gap:8px}",
			// ── 侧边栏小组件 ──
			".dshg-side{display:flex;align-items:stretch;gap:6px;width:100%;min-width:0;padding:0 6px 2px;box-sizing:border-box}",
			".dshg-side.collapsed{justify-content:center;padding:0;gap:4px}",
			".dshg-seg{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);cursor:pointer}",
			".dshg-seg:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshg-segLabel{font-size:10.5px;line-height:14px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-segValue{font-size:12.5px;line-height:17px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-segValue.dim{font-weight:400;color:var(--dsw-alias-label-tertiary)}",
			".dshg-progress{height:4px;width:100%;overflow:hidden;border-radius:999px;background:var(--dsw-alias-bg-mask-1)}",
			".dshg-progressFill{height:100%;border-radius:999px;background:var(--dsw-alias-state-success-primary);transition:width .25s ease}",
			".dshg-progressFill.warn{background:var(--dsw-alias-state-warn-primary)}",
			".dshg-quotaMeta{font-size:10px;line-height:13px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}",
			".dshg-segActions{display:flex;align-items:center;gap:5px;margin-top:3px}",
			".dshg-segBtn{display:inline-flex;align-items:center;justify-content:center;height:20px;margin:0;padding:0 8px;border:0;border-radius:6px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-inverted);text-decoration:none;font-family:inherit;font-size:10.5px;line-height:20px;cursor:pointer}",
			".dshg-segBtn:hover{background:var(--dsw-alias-button-primary-hover)}",
			".dshg-railBtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:50%;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:600;text-decoration:none;cursor:pointer}",
			".dshg-railBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dshg-railDot{width:6px;height:6px;border-radius:50%;flex:none;margin-top:9px}",
			".dshg-railDot.on{background:var(--dsw-alias-state-success-primary)}",
			".dshg-railDot.off{background:var(--dsw-alias-label-tertiary)}",
			// ── 侧边栏自适应：与其他全宽按钮（如插件市场）共存时，让槽位容器换行、本卡片独占一行 ──
			"div:has(> div > .dshg-side:not(.collapsed)){flex-wrap:wrap}",
			".dshg-side:not(.collapsed){flex:1 1 100%}",
		].join("");

		// ── 共享数据 hook ────────────────────────────────────────────────

		function useChatGptState() {
			const [state, setState] = useState({ loading: true, status: null, quota: null });
			const [attempt, setAttempt] = useState(0);

			useEffect(() => {
				let cancelled = false;
				const load = () => {
					setState((s) => ({ ...s, loading: true }));
					Promise.all([
						fetch(STATUS_URL, { headers: { accept: "application/json" } }).then((r) => r.json().catch(() => null)),
						fetch(QUOTA_URL, { headers: { accept: "application/json" } }).then((r) => r.json().catch(() => null)),
					]).then(([status, quota]) => {
						if (cancelled) return;
						setState({
							loading: false,
							status: status && status.ok === true ? status : null,
							quota: quota && quota.ok === true ? quota : null,
						});
					}).catch(() => {
						if (!cancelled) setState({ loading: false, status: null, quota: null });
					});
				};
				load();
				const timer = setInterval(load, 60_000);
				return () => { cancelled = true; clearInterval(timer); };
			}, [attempt]);

			const refresh = () => setAttempt((n) => n + 1);
			return { ...state, refresh };
		}

		function useDeepSeekBalance() {
			const [balance, setBalance] = useState(null);
			const [attempt, setAttempt] = useState(0);
			useEffect(() => {
				let cancelled = false;
				const load = () => {
					fetch(BALANCE_URL, { headers: { accept: "application/json" } })
						.then((r) => r.json().catch(() => null))
						.then((body) => { if (!cancelled && body && body.ok === true && body.data) setBalance(body.data); })
						.catch(() => { /* keep last */ });
				};
				load();
				// 余额每分钟自动刷新（与 ChatGPT 额度同频），避免长期停留在旧值。
				const timer = setInterval(load, 60_000);
				return () => { cancelled = true; clearInterval(timer); };
			}, [attempt]);
			return { balance, refresh: () => setAttempt((n) => n + 1) };
		}

		function planLabel(plan) {
			if (!plan) return "ChatGPT";
			const map = { plus: "Plus", pro: "Pro", free: "免费" };
			return `ChatGPT ${map[plan] ?? plan}`;
		}

		function quotaChip(quota, loggedIn) {
			if (!loggedIn) return { text: "未登录", cls: "off" };
			if (!quota) return { text: "额度…", cls: "off" };
			if (quota.status === "available") return { text: "额度可用", cls: "on" };
			if (quota.status === "limited") return { text: "额度用尽", cls: "warn" };
			if (quota.status === "invalidated") return { text: "登录失效", cls: "warn" };
			return { text: "额度未知", cls: "off" };
		}

		function remainingPercent(quota) {
			return typeof quota?.usedPercent === "number" ? Math.max(0, Math.min(100, 100 - quota.usedPercent)) : null;
		}

		function resetLabel(quota) {
			if (!quota?.resetAfterSeconds) return "";
			const hours = Math.ceil(quota.resetAfterSeconds / 3600);
			return hours >= 24 ? `${Math.ceil(hours / 24)}天后重置` : `${hours}小时后重置`;
		}

		// ── 侧边栏组件（设置按钮上方） ──────────────────────────────────

		function SidebarWidget({ wide }) {
			const chat = useChatGptState();
			const ds = useDeepSeekBalance();
			const [switchCode, setSwitchCode] = useState(null);
			const [switching, setSwitching] = useState(false);
			const [openHint, setOpenHint] = useState(null);
			const loggedIn = chat.status?.loggedIn === true;
			const info = chat.status?.account ?? chat.status?.accountId;
			const chip = quotaChip(chat.quota, loggedIn);

			// 设备码授权（备用路径）。
			const startDeviceFlow = () => {
				const popup = window.open("about:blank", "_blank");
				setSwitching(true);
				fetch(LOGIN_START_URL, { method: "POST", headers: { accept: "application/json" } })
					.then((r) => r.json().catch(() => null))
					.then((body) => {
						setSwitching(false);
						if (body?.ok) {
							setSwitchCode(body.userCode);
							if (popup) popup.location.href = body.verificationUrl;
							else window.open(body.verificationUrl, "_blank");
						} else if (popup) {
							popup.close();
						}
					})
					.catch(() => { setSwitching(false); if (popup) popup.close(); });
			};

			// 主路径：打开 CodexManager（登录走 auth.openai.com/choose-an-account），
			// token 由 CodexManager 写回 ~/.codex/auth.json，插件自动同步。
			const switchAccount = () => {
				if (chat.status?.managerAvailable) {
					setSwitching(true);
					fetch(MANAGER_OPEN_URL, { method: "POST", headers: { accept: "application/json" } })
						.then((r) => r.json().catch(() => null))
						.then((body) => {
							setSwitching(false);
							if (body?.ok) {
								setOpenHint(body?.verifyUrl ? "已打开 CodexManager：请在其中登录/切换账号，DSH 会自动跟随。" : "已打开 CodexManager");
							} else {
								setOpenHint("未检测到 CodexManager，改用网页授权登录。");
								startDeviceFlow();
							}
						})
						.catch(() => { setSwitching(false); setOpenHint("打开 CodexManager 失败，改用网页授权登录。"); startDeviceFlow(); });
					return;
				}
				startDeviceFlow();
			};

			useEffect(() => {
				if (!switchCode) return;
				const timer = setInterval(() => {
					fetch(LOGIN_STATUS_URL, { headers: { accept: "application/json" } })
						.then((r) => r.json().catch(() => null))
						.then((body) => {
							if (body?.state === "approved") { setSwitchCode(null); chat.refresh(); }
						})
					.catch(() => {});
				}, 3000);
				return () => clearInterval(timer);
			}, [switchCode]);

			useEffect(() => {
				const style = document.createElement("style");
				style.setAttribute("data-dsh-chatgpt-login", "");
				style.textContent = CSS_TEXT;
				document.head.appendChild(style);
				return () => { style.remove(); };
			}, []);

			if (!wide) {
				// 折叠侧边栏：充值按钮 + 登录状态小点
				return jsxs("div", {
					className: "dshg-side collapsed",
					children: [
						jsx("a", { className: "dshg-railBtn", href: RECHARGE_URL, target: "_blank", rel: "noopener noreferrer", title: "DeepSeek 充值", children: "¥" }),
						jsx("a", {
							className: "dshg-railBtn",
							href: CHATGPT_URL,
							target: "_blank",
							rel: "noopener noreferrer",
							title: loggedIn ? `ChatGPT（${info ?? "已登录"}）` : "打开 ChatGPT",
							children: jsx("span", { className: loggedIn ? "dshg-railDot on" : "dshg-railDot off" }),
						}),
					],
				});
			}

			const info1 = ds.balance?.balance_infos?.[0];
			const amount = info1
				? `${info1.currency === "CNY" ? "¥" : (info1.currency ?? "") + " "}${Number(info1.total_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
				: "—";

			return jsxs("div", {
				className: "dshg-side",
				onClick: chat.refresh,
				title: "点击刷新",
				children: [
					jsxs("div", {
						className: "dshg-seg",
						children: [
							jsx("span", { className: "dshg-segLabel", children: "DeepSeek 余额" }),
							jsx("span", { className: "dshg-segValue", children: amount }),
							jsx("a", { className: "dshg-segBtn", href: RECHARGE_URL, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), children: "充值" }),
						],
					}),
					jsxs("div", {
						className: "dshg-seg",
						children: [
							jsx("span", { className: "dshg-segLabel", children: planLabel(chat.status?.plan) }),
							!loggedIn && jsx("span", { className: "dshg-segValue dim", children: "未登录" }),
							loggedIn && remainingPercent(chat.quota) !== null && jsx("div", { className: "dshg-progress", children: jsx("div", { className: `dshg-progressFill${chip.cls === "warn" ? " warn" : ""}`, style: { width: `${remainingPercent(chat.quota)}%` } }) }),
							loggedIn && remainingPercent(chat.quota) !== null && jsx("span", { className: "dshg-quotaMeta", children: switchCode ? `授权码 ${switchCode}` : (openHint ?? `剩余 ${remainingPercent(chat.quota)}% · ${resetLabel(chat.quota)}`) }),
							!loggedIn && jsx("span", { className: "dshg-quotaMeta", children: switchCode ? `授权码 ${switchCode}` : (openHint ?? "") }),
							jsxs("div", { className: "dshg-segActions", children: [
								jsx("a", { className: "dshg-segBtn", href: CHATGPT_URL, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), children: loggedIn ? "打开" : "登录" }),
								jsx("button", { type: "button", className: "dshg-segBtn", disabled: switching, onClick: (e) => { e.stopPropagation(); switchAccount(); }, children: switching ? "授权中…" : "切换账号" }),
							] }),
						],
					}),
				],
			});
		}

		// ── 设置页 ChatGPT 卡片 ─────────────────────────────────────────

		function ChatGptLoginSection() {
			const chat = useChatGptState();
			const ds = useDeepSeekBalance();
			const [flow, setFlow] = useState(null);
			const [msg, setMsg] = useState(null);
			const [busy, setBusy] = useState(false);

			useEffect(() => {
				const style = document.createElement("style");
				style.setAttribute("data-dsh-chatgpt-login", "");
				style.textContent = CSS_TEXT;
				document.head.appendChild(style);
				return () => { style.remove(); };
			}, []);

			useEffect(() => {
				if (!flow || flow.state !== "pending") return;
				const tick = () => {
					fetch(LOGIN_STATUS_URL, { headers: { accept: "application/json" } })
						.then((r) => r.json().catch(() => null))
						.then((body) => {
							if (!body || !body.ok) return;
							if (body.state === "approved") {
								setFlow({ ...flow, state: "approved" });
								setMsg({ kind: "ok", text: "授权成功！ChatGPT 已接入 DSH。" });
								chat.refresh();
							} else if (body.state === "failed" || body.state === "expired") {
								setFlow({ ...flow, state: body.state });
								setMsg({ kind: "bad", text: body.message ?? "授权失败，请重试。" });
							}
						})
						.catch(() => { /* keep polling */ });
				};
				const timer = setInterval(tick, 3000);
				return () => clearInterval(timer);
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [flow]);

			const status = chat.status;
			const loggedIn = status?.loggedIn === true;
			const managedByCodex = status?.source === "codex-manager";
			const chip = quotaChip(chat.quota, loggedIn);

			const startLogin = () => {
				const popup = window.open("about:blank", "_blank");
				setBusy(true);
				setMsg(null);
				fetch(LOGIN_START_URL, { method: "POST", headers: { accept: "application/json" } })
					.then((r) => r.json().catch(() => null))
					.then((body) => {
						setBusy(false);
						if (body && body.ok === true) {
							setFlow({ state: "pending", userCode: body.userCode, verificationUrl: body.verificationUrl });
							if (popup) popup.location.href = body.verificationUrl;
							else window.open(body.verificationUrl, "_blank");
						} else {
							if (popup) popup.close();
							setMsg({ kind: "bad", text: body?.message ?? "发起授权失败。" });
						}
					})
					.catch(() => { setBusy(false); if (popup) popup.close(); setMsg({ kind: "bad", text: "网络请求失败，请稍后重试。" }); });
			};

			// 主路径：打开 CodexManager（登录走 auth.openai.com/choose-an-account），
			// 同步监听会接住 CodexManager 写回的 ~/.codex/auth.json。
			const openManager = () => {
				setBusy(true);
				setMsg(null);
				fetch(MANAGER_OPEN_URL, { method: "POST", headers: { accept: "application/json" } })
					.then((r) => r.json().catch(() => null))
					.then((body) => {
						setBusy(false);
						if (body?.ok) {
							setMsg({ kind: "ok", text: "已打开 CodexManager：在其中登录/切换账号（auth.openai.com/choose-an-account），DSH 会自动跟随。" });
						} else {
							setMsg({ kind: "bad", text: body?.message ?? "未检测到 CodexManager。" });
						}
					})
					.catch(() => { setBusy(false); setMsg({ kind: "bad", text: "打开 CodexManager 失败。" }); });
			};

			const logout = () => {
				setBusy(true);
				fetch(LOGOUT_URL, { method: "POST", headers: { accept: "application/json" } })
					.then((r) => r.json().catch(() => null))
					.then((body) => {
						setBusy(false);
						setFlow(null);
						setMsg({ kind: "ok", text: body?.ok ? "已退出登录。" : "退出失败。" });
						chat.refresh();
					})
					.catch(() => { setBusy(false); setMsg({ kind: "bad", text: "退出失败，请稍后重试。" }); });
			};

			let statusBody;
			if (chat.loading) {
				statusBody = jsx("div", { className: "dshg-loading", children: "正在读取状态…" });
			} else {
				statusBody = jsxs("div", {
					className: "dshg-statusRow",
					children: [
						jsx("span", { className: "dshg-status", children: loggedIn ? "已登录" : "未登录" }),
						jsx("span", { className: "dshg-sub", children: managedByCodex ? "由 CodexManager 同步账号" : (loggedIn ? "网页授权" : "尚未接入") }),
					],
				});
				if (loggedIn && chat.quota?.status === "invalidated") {
					statusBody = jsxs("div", { className: "dshg-statusRow", children: [
						jsx("span", { className: "dshg-chip warn", children: "登录失效" }),
						jsx("span", { className: "dshg-sub", children: "ChatGPT 会话已过期，请打开 CodexManager 重新登录，DSH 会自动同步。" }),
					] });
				}
			}

			let accountBody = null;
			if (loggedIn) {
				accountBody = jsxs("div", {
					className: "dshg-sub",
					children: [
						status?.source === "codex-manager" ? "由 CodexManager 管理账号，切换后 DSH 自动跟随。" : "网页授权账号，令牌将自动刷新。",
					],
				});
			}

			let flowBody = null;
			if (flow && flow.state === "pending") {
				flowBody = jsxs("div", {
					className: "dshg-flow",
					children: [
						jsx("div", { className: "dshg-code", children: flow.userCode }),
						jsx("div", { className: "dshg-hint", children: "网页授权码登录：在打开的 OpenAI 登录页输入上方授权码并点击「继续」，授权成功后自动接入 DSH。" }),
						jsxs("div", {
							className: "dshg-actions",
							children: [
								jsx("a", { className: "dshg-primary", href: flow.verificationUrl, target: "_blank", rel: "noopener noreferrer", children: "打开登录页" }),
								jsx("span", { className: "dshg-hint", children: "若页面未打开，请访问 auth.openai.com/codex/device 输入授权码" }),
							],
						}),
					],
				});
			}

			const dsInfo = ds.balance?.balance_infos?.[0];
			const dsCurrency = dsInfo?.currency === "CNY" ? "¥" : (dsInfo?.currency ?? "");
			const dsAmount = dsInfo ? `${dsCurrency}${Number(dsInfo.total_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
			const dsProvider = jsxs("div", {
				className: "dshg-provider",
				children: [
					jsxs("div", { className: "dshg-providerHead", children: [
						jsx("span", { className: "dshg-providerTitle", children: "DeepSeek" }),
						jsx("span", { className: "dshg-balanceAmount", children: dsAmount }),
					] }),
					dsInfo && jsxs("div", { className: "dshg-detailRows", children: [
						jsxs("div", { className: "dshg-detailRow", children: [jsx("span", { className: "dshg-detailLabel", children: "充值余额" }), jsx("span", { className: "dshg-detailValue", children: `${dsCurrency}${Number(dsInfo.topped_up_balance).toFixed(2)}` })] }),
						jsxs("div", { className: "dshg-detailRow", children: [jsx("span", { className: "dshg-detailLabel", children: "赠送余额" }), jsx("span", { className: "dshg-detailValue", children: `${dsCurrency}${Number(dsInfo.granted_balance).toFixed(2)}` })] }),
					] }),
					jsxs("div", { className: "dshg-providerActions", children: [
						jsx("span", { className: "dshg-hint", children: "余额不足会影响对话" }),
						jsx("a", { className: "dshg-primary", href: RECHARGE_URL, target: "_blank", rel: "noopener noreferrer", children: "去充值" }),
					] }),
				],
			});

			return jsxs("div", {
				className: "dshg-card",
				children: [
					jsxs("div", {
						className: "dshg-head", 
						children: [
							jsx("span", { className: "dshg-title", children: "供应商余额与额度" }),
							jsx("button", { type: "button", className: "dshg-refresh", onClick: () => { chat.refresh(); ds.refresh(); }, disabled: chat.loading, children: "刷新" }),
						],
					}),
					dsProvider,
					jsx("div", { className: "dshg-providerTitle", children: planLabel(status?.plan) }),
					statusBody,
					accountBody,
					loggedIn && remainingPercent(chat.quota) !== null && jsxs("div", { className: "dshg-quotaBlock", children: [
						jsx("div", { className: "dshg-sub", children: `剩余 ${remainingPercent(chat.quota)}%${resetLabel(chat.quota) ? ` · ${resetLabel(chat.quota)}` : ""}` }),
						jsx("div", { className: "dshg-progress", children: jsx("div", { className: `dshg-progressFill${chip.cls === "warn" ? " warn" : ""}`, style: { width: `${remainingPercent(chat.quota)}%` } }) }),
					]}),
					flowBody,
					jsxs("div", {
						className: "dshg-actions",
						children: [
							status?.managerAvailable
								? jsx("button", { type: "button", className: "dshg-primary", onClick: openManager, disabled: busy, children: loggedIn ? "打开 CodexManager 切换" : "用 CodexManager 登录" })
								: jsx("button", { type: "button", className: "dshg-primary", onClick: startLogin, disabled: busy, children: loggedIn ? "切换账号" : "网页授权登录" }),
							status?.managerAvailable && jsx("button", { type: "button", className: "dshg-ghost", onClick: startLogin, disabled: busy, children: "网页授权登录（备用）" }),
							jsx("a", { className: "dshg-ghost", href: CHOOSE_ACCOUNT_URL, target: "_blank", rel: "noopener noreferrer", children: "OpenAI 账号登录" }),
							jsx("a", { className: "dshg-ghost", href: CHATGPT_URL, target: "_blank", rel: "noopener noreferrer", children: "打开 ChatGPT" }),
							loggedIn && !managedByCodex && jsx("button", { type: "button", className: "dshg-ghost danger", onClick: logout, disabled: busy, children: "退出登录" }),
						],
					}),
					msg !== null && jsx("div", { className: msg.kind === "ok" ? "dshg-msg ok" : "dshg-msg bad", children: msg.text }),
					jsx("div", { className: "dshg-hint", children: "已连接时，ChatGPT 模型（GPT-5.x）会出现在模型选择器中。CodexManager 切换账号后 DSH 自动跟随；额度数据来自 ChatGPT 官方 Codex 用量接口，90 秒缓存。" }),
				],
			});
		}

		// ── 注册 ────────────────────────────────────────────────────────

		function apply(ctx) {
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "chatgpt-widget",
				order: -10,
				inject: () => ({}),
			}, SidebarWidget));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "chatgpt-login",
				order: -90,
				label: () => "供应商余额与额度",
				inject: () => ({}),
			}, ChatGptLoginSection));
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	},
});
