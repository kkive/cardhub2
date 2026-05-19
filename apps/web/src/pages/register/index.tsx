import React, { useState } from 'react';
import { history } from '@umijs/max';
import { Button, Card, Form, Input, message, Space, Tabs, Typography } from 'antd';
import { LockOutlined, MailOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';

const { Title, Text, Link } = Typography;

const RegisterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handlePasswordRegister = async (values: {
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
  }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次密码输入不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          username: values.username,
          password: values.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.message || '注册失败');
        return;
      }
      message.success('注册成功，请登录');
      history.push('/login');
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyRegister = async (values: { email: string; username: string }) => {
    setLoading(true);
    try {
      // First create user account
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          username: values.username,
          password: Math.random().toString(36).slice(2), // random password for passkey-only users
        }),
      });
      if (!regRes.ok) {
        const err = await regRes.json();
        message.error(err.message || '注册失败');
        return;
      }
      const user = await regRes.json();

      // TODO: Use browser WebAuthn API to register passkey
      message.info('Passkey 注册需要浏览器 WebAuthn 支持，正在开发中');
      message.success('账户已创建，请登录');
      history.push('/login');
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const passwordForm = (
    <Form onFinish={handlePasswordRegister} size="large">
      <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
        <Input prefix={<MailOutlined />} placeholder="邮箱" />
      </Form.Item>
      <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input prefix={<UserOutlined />} placeholder="用户名" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
      </Form.Item>
      <Form.Item name="confirmPassword" rules={[{ required: true, message: '请确认密码' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          注册
        </Button>
      </Form.Item>
    </Form>
  );

  const passkeyForm = (
    <Form onFinish={handlePasskeyRegister} size="large">
      <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
        <Input prefix={<MailOutlined />} placeholder="邮箱" />
      </Form.Item>
      <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input prefix={<UserOutlined />} placeholder="用户名" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} icon={<SafetyCertificateOutlined />} block>
          Passkey 注册
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: 16, boxSizing: 'border-box', width: '100%' }}>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          注册
        </Title>
        <Tabs
          items={[
            { key: 'password', label: '密码注册', children: passwordForm },
            { key: 'passkey', label: 'Passkey 注册', children: passkeyForm },
          ]}
        />
        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Text type="secondary">
            已有账户？ <Link onClick={() => history.push('/login')}>登录</Link>
          </Text>
        </Space>
      </Card>
    </div>
  );
};

export default RegisterPage;
