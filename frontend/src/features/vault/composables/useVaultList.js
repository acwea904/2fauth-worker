import { ref, shallowRef, computed, watch, triggerRef } from 'vue'
import { useInfiniteQuery, useQueryClient } from '@tanstack/vue-query'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { vaultService } from '@/features/vault/service/vaultService'

/**
 * 管理金库账号的分页列表数据获取与搜索
 * 
 * 架构说明 (Architecture Notes):
 * 1. 渲染时序防闪烁: 采用「两级渲染策略」。针对已有账号（已包含计算好的 TOTP 验证码）直接复用；
 *    针对新加载分页的新账号，先触发 `afterLoadRef` 在后台预计算验证码，完成之后再赋值给 `vault.value`。
 *    这种先计算后一次性赋值的浅引用 (shallowRef) 机制，避免了验证码变为 "------" 然后闪换的情况。
 * 2. 缓存秒开机制: `staleTime` 设置为 60s。当用户从外部组件切回主页时，若在 60s 内，
 *    直接利用 Vue Query 的现有缓存（保留已有账号的 TOTP `currentCode` 和动态倒计时 `remaining`），
 *    消除 Loading 空白期的出现。也不会触发多余的重复分页加载以及昂贵的 PBKDF2 （`vaultStore.saveData`）加解密迭代开销。
 * 3. 并发解耦: 本 Composable `useVaultList` 独立负责 Vue Query 分页和本地缓存维护（`vaultStore.saveData`）。
 *    对于后续验证码计算的具体逻辑，委托给外部通过参数 `afterLoadRef` 回调。
 * 
 * @param {import('vue').Ref<Function|null>} afterLoadRef - 可选的 ref，指向数据合并后的异步回调（如 updateVaultStatus）
 * @returns Composable state and actions
 */
export function useVaultList(afterLoadRef = null) {
    const vaultStore = useVaultStore()
    const queryClient = useQueryClient()

    const vault = shallowRef([])
    const searchQuery = ref('')
    const pageSize = ref(12)

    // --- Vue Query 分页逻辑 ---
    const fetchVaultPage = async ({ pageParam = 1 }) => {
        if (!vaultStore.isUnlocked) return { vault: [], pagination: { totalPages: 0 } }
        return await vaultService.getVault({
            page: pageParam,
            limit: pageSize.value,
            search: searchQuery.value
        })
    }

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isFetching,
        isError,
        refetch
    } = useInfiniteQuery({
        queryKey: ['vault', searchQuery],
        queryFn: fetchVaultPage,
        getNextPageParam: (lastPage) => {
            if (!lastPage || !lastPage.pagination) return undefined
            const { page, totalPages } = lastPage.pagination
            return page < totalPages ? page + 1 : undefined
        },
        enabled: computed(() => vaultStore.isUnlocked),
        // 60 秒内切换回来直接用缓存，不触发逐页重拉（避免多次 PBKDF2 saveData 开销）
        // invalidateQueries / resetQueries 调用时会忽略 staleTime，强制立即刷新
        staleTime: 60 * 1000,
    })

    // 监听数据变化，同步到本地 vault 引用
    watch(data, async (newData) => {
        if (!newData) return

        // 智能合并：保留已有账号的 TOTP 实时状态，新增账号初始化响应式属性
        const flatVault = newData.pages.flatMap(p => p.vault || [])
        const merged = flatVault.map(newAcc => {
            const existing = vault.value.find(a => a.id === newAcc.id)
            if (existing) {
                return { ...existing, ...newAcc }  // 保留 currentCode / remaining 等动态字段
            }
            return {
                ...newAcc,
                currentCode: '------',
                nextCode: null,
                remaining: 30,
                percentage: 0,
                color: ''
            }
        })

        // 两级渲染策略，兼顾「无 ------ 闪烁」与「切换回来秒开」：
        // 1. 找出真正的新增项（已有项 currentCode 有值，直接复用，无需重算）
        const newItems = merged.filter(acc => !acc.currentCode || acc.currentCode === '------')

        if (newItems.length > 0) {
            // 2. 只为新增项预计算 TOTP（通常 12 条/页，耗时极短），避免显示 "------"
            //    updateVaultStatus(newItems) 仅修改 newItems 元素属性，不调用 triggerRef
            const cb = afterLoadRef?.value ?? afterLoadRef
            if (typeof cb === 'function') {
                await cb(newItems)
            }
        }

        // 3. 一次赋值完成渲染：已有项复用原有验证码，新增项验证码已预计算完毕
        //    shallowRef .value = 新引用会自动通知 Vue，无需额外 triggerRef
        vault.value = merged

        // 无搜索词时保存全量缓存（使用正确的 vaultStore API）
        if (!searchQuery.value && vaultStore.isUnlocked) {
            try {
                await vaultStore.saveData({ vault: merged })
                vaultStore.clearDirty()
            } catch (e) {
                // 缓存写入失败静默处理
            }
        }
    }, { deep: false })

    // 公开的 fetchVault 方法（用于父组件通过 ref 手工刷新）
    // 使用 invalidateQueries 而非 resetQueries：保留缓存仅标记为过期，
    // 切换回账号列表时可立即从缓存显示，后台静默刷新，无需重新拉取所有分页。
    const fetchVault = () => {
        queryClient.invalidateQueries({ queryKey: ['vault'] })
    }

    // 无限滚动加载
    const isLoadMoreDisabled = computed(() =>
        !hasNextPage.value || isFetchingNextPage.value || !vaultStore.isUnlocked || isError.value
    )

    const handleLoadMore = () => {
        if (!isLoadMoreDisabled.value) {
            fetchNextPage()
        }
    }

    return {
        vault,
        searchQuery,
        pageSize,
        isLoading,
        isFetching,
        isFetchingNextPage,
        hasNextPage,
        isError,
        isLoadMoreDisabled,
        fetchVault,
        handleLoadMore,
        refetch
    }
}
