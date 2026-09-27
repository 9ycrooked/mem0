"use client";

/**
 * 自维护 fork 开关：是否显示官方前端的升级引流横幅（UpgradeBanner）。
 *
 * 这些横幅在自托管场景下的作用是把你引导到 Mem0 Cloud 注册页（带 UTM 埋点），
 * 例如：
 *   - memories 页：记忆数 ≥ 1000 时提示「Categories can help organize them」
 *   - api-keys 页：密钥数 ≥ 3 时提示「Cloud offers project-based isolation」
 *   - upgrade-banner 组件本身还支持 dismiss
 *
 * 与侧边栏 CLOUD FEATURES 的处理方式一致：**不删代码，只加开关**，
 * 置 true 即恢复官方行为，从而把上游合并的冲突面降到最低。
 */
export const SHOW_UPGRADE_BANNERS = false;
