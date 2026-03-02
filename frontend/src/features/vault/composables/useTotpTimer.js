import { onMounted, onUnmounted, triggerRef } from 'vue'
import { generateTOTP } from '@/shared/utils/totp'

/**
 * 管理所有保险箱账号的 TOTP 验证码与倒计时刷新
 * 
 * 架构说明 (Architecture Notes):
 * 1. 性能优化 (Parallel Computation): 循环列表触发 HMAC-SHA-1 等 Hash 计算是昂贵的 CPU 任务。
 *    因此，遍历 Vault 时摒弃串行 `await`，采取 `Promise.all` 全并发模式，榨干宏任务的吞吐量，
 *    以实现成百上千条账号依然不阻塞验证码更新的渲染节奏。
 * 2. 批量渲染 (Reactivity Batches): 受益于 Vue 的依赖收集，将 `vault` 定义为 `shallowRef`，
 *    在批量计算结束后调用唯一一次 `triggerRef(vault)`，从而使得深层的 1000 次元素级属性修改合并成了
 *    Vue 的一次虚拟 DOM 树 diff 与重绘。
 * 3. 异步分流: 将 5 秒即将变色的逻辑与下次新 Code 的提前量生成机制解耦，确保证预计算。
 * 
 * @param {import('vue').ShallowRef} vault - 当前账号列表的 shallowRef
 * @returns Composable lifecycle bindings (auto-mounted via onMounted/onUnmounted)
 */
export function useTotpTimer(vault) {
    let globalTimer = null

    /**
     * 并发计算所有账号的 TOTP 验证码与剩余时间
     * @param {Object[]} [targetList] - 可选，传入用于首次渲染前的预计算
     */
    const updateVaultStatus = async (targetList) => {
        const list = Array.isArray(targetList) ? targetList : vault.value
        if (!list || list.length === 0) return

        const now = Date.now() / 1000

        // 使用 Promise.all 并行处理所有账号的计算，避免串行 await 导致验证码生成延迟
        await Promise.all(list.map(async (acc) => {
            const period = acc.period || 30
            const remaining = Math.ceil(period - (now % period))
            acc.remaining = remaining
            acc.percentage = (remaining / period) * 100

            // 颜色逻辑
            if (remaining > 10) acc.color = '#67C23A'
            else if (remaining > 5) acc.color = '#E6A23C'
            else acc.color = '#F56C6C'

            // 计算当前验证码（epoch 变化时或首次计算）
            const currentEpoch = Math.floor(now / period)
            const algorithm = acc.algorithm
                ? acc.algorithm.replace('SHA', 'SHA-').replace('SHA--', 'SHA-')
                : 'SHA-1'

            if (acc.lastEpoch !== currentEpoch || !acc.currentCode || acc.currentCode === '------') {
                acc.currentCode = await generateTOTP(acc.secret, period, acc.digits, algorithm)
                acc.lastEpoch = currentEpoch
            }

            // 剩余 5 秒时预计算下一段验证码
            if (remaining <= 5) {
                if (!acc.nextCode || acc.lastNextEpoch !== currentEpoch + 1) {
                    acc.nextCode = await generateTOTP(acc.secret, period, acc.digits, algorithm, 1)
                    acc.lastNextEpoch = currentEpoch + 1
                }
            } else {
                acc.nextCode = null
            }
        }))

        // shallowRef 需要手动通知，合并所有深层属性变更为一次 UI 重绘
        // 渲染来源分流 (Trigger Control):
        // 1. 无 targetList 传参时（由内部 1 秒定时器调用）：因为仅原地修改属性，没改变浅引用，需手动 triggerRef 才能重绘 UI。
        // 2. 有 targetList 传参时（由外部 useVaultList 初筛调用）：因为外边马上就要走 `vault.value = merged` 浅引用赋值逻辑，
        //    所以这里绝对静默，不可调用 triggerRef，否则将打破单次重绘策略并造成 "------" 闪屏重演。
        if (!Array.isArray(targetList)) {
            triggerRef(vault)
        }
    }

    const startTimer = () => {
        updateVaultStatus() // 立即计算一次
        globalTimer = setInterval(() => updateVaultStatus(), 1000)
    }

    const stopTimer = () => {
        if (globalTimer) {
            clearInterval(globalTimer)
            globalTimer = null
        }
    }

    onMounted(startTimer)
    onUnmounted(stopTimer)

    return {
        updateVaultStatus,
        startTimer,
        stopTimer
    }
}
