<template>
  <div class="add-vault-wrapper">
    <div class="tab-card-wrapper">
      <h2 style="text-align: center; margin-bottom: 20px;">⌨️ 手动输入</h2>
      <div style="max-width: 600px; margin: 0 auto;">
        <el-form :model="newVault" label-position="top" :rules="rules" ref="addFormRef" style="padding: 10px 0;">
          <el-form-item label="服务名称 (如 Google, GitHub)" prop="service">
            <el-input v-model="newVault.service" placeholder="请输入服务名称" />
          </el-form-item>
          <el-form-item label="账号标识 (如 邮箱地址)" prop="account">
            <el-input v-model="newVault.account" placeholder="请输入账号或邮箱" />
          </el-form-item>
          <el-form-item label="安全密钥 (Base32格式)" prop="secret">
            <el-input v-model="newVault.secret" placeholder="请输入 16 位以上的安全密钥" clearable>
              <template #append>
                <el-button @click="generateRandomSecret" title="随机生成密钥"><el-icon><Refresh /></el-icon></el-button>
              </template>
            </el-input>
          </el-form-item>
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="代码位数" prop="digits">
                <el-select v-model="newVault.digits" style="width: 100%">
                  <el-option label="6 位" :value="6" />
                  <el-option label="8 位" :value="8" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="更新周期" prop="period">
                <el-select v-model="newVault.period" style="width: 100%">
                  <el-option label="30 秒" :value="30" />
                  <el-option label="60 秒" :value="60" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="算法" prop="algorithm">
                <el-select v-model="newVault.algorithm" style="width: 100%">
                  <el-option label="SHA1 (常用)" value="SHA1" />
                  <el-option label="SHA256" value="SHA256" />
                  <el-option label="SHA512" value="SHA512" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="分类 (可选)" prop="category">
            <el-input v-model="newVault.category" placeholder="如 工作, 个人" />
          </el-form-item>
          <el-form-item style="margin-top: 30px;">
            <el-button type="primary" :loading="submitting" @click="submitAddVault" style="width: 100%;" size="large">确认添加</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { bytesToBase32 } from '@/shared/utils/totp'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { vaultService } from '@/features/vault/service/vaultService'

const emit = defineEmits(['success'])

const vaultStore = useVaultStore()
const submitting = ref(false)
const addFormRef = ref(null)
const newVault = ref({
  service: '', account: '', secret: '', category: '', digits: 6, period: 30, algorithm: 'SHA1'
})

const validateSecret = (rule, value, callback) => {
  if (!value) {
    return callback(new Error('请输入安全密钥'))
  }
  // 移除空格后检查
  const clean = value.replace(/\s/g, '')
  if (clean.length < 16) {
    return callback(new Error('密钥长度通常不少于 16 位'))
  }
  if (!/^[A-Z2-7]+$/i.test(clean)) {
    return callback(new Error('包含非法字符 (仅限 A-Z, 2-7)'))
  }
  callback()
}

const rules = {
  service: [{ required: true, message: '请输入服务名称', trigger: 'blur' }],
  account: [{ required: true, message: '请输入账号标识', trigger: 'blur' }],
  secret: [{ required: true, validator: validateSecret, trigger: 'blur' }]
}

const generateRandomSecret = () => {
  const array = new Uint8Array(20)
  window.crypto.getRandomValues(array)
  newVault.value.secret = bytesToBase32(array)
}

const submitAddVault = async () => {
  if (!addFormRef.value) return
  await addFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        const data = await vaultService.createAccount(newVault.value)
        if (data.success) {
          ElMessage.success('账号添加成功！')
          newVault.value = { service: '', account: '', secret: '', category: '', digits: 6, period: 30, algorithm: 'SHA1' }
          vaultStore.markDirty() // 实际写入数据，标记缓存过期
          emit('success')
        }
      } catch (error) {
      } finally {
        submitting.value = false
      }
    }
  })
}
</script>