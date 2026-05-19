import React, { useState } from 'react';
import { history, useModel } from '@umijs/max';
import { Button, Card, Form, Input, message, Space, Tabs, Typography } from 'antd';
import { LockOutlined, MailOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';

const { Title, Text, Link } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { refresh } = useModel('@@initialState');

  const handlePasswordLogin = async (values: { emailOrUsername: string; password: string }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.message || '登录失败');
        return;
      }
      localStorage.setItem('token', data.token);
      message.success('登录成功');
      await refresh();
      history.push('/cards');
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async (values: { email: string }) => {
    setLoading(true);
    try {
      // Get challenge
      const challengeRes = await fetch('/api/passkey/login/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      });
      if (!challengeRes.ok) {
        const err = await challengeRes.json();
        message.error(err.message || '获取挑战失败');
        return;
      }
      const challengeData = await challengeRes.json();

      // TODO: Use browser WebAuthn API to get credential
      // For now, show message that Passkey login requires browser support
      message.info('Passkey 登录需要浏览器 WebAuthn 支持，正在开发中');
    } catch {
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const passwordForm = (
    <Form onFinish={handlePasswordLogin} size="large">
      <Form.Item name="emailOrUsername" rules={[{ required: true, message: '请输入邮箱或用户名' }]}>
        <Input prefix={<UserOutlined />} placeholder="邮箱或用户名" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          登录
        </Button>
      </Form.Item>
    </Form>
  );

  const passkeyForm = (
    <Form onFinish={handlePasskeyLogin} size="large">
      <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
        <Input prefix={<MailOutlined />} placeholder="邮箱" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} icon={<SafetyCertificateOutlined />} block>
          Passkey 登录
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: 16, boxSizing: 'border-box', width: '100%' }}>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          登录
        </Title>
        <Tabs
          items={[
            { key: 'password', label: '密码登录', children: passwordForm },
            { key: 'passkey', label: 'Passkey 登录', children: passkeyForm },
          ]}
        />
        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Text type="secondary">
            还没有账户？ <Link onClick={() => history.push('/register')}>注册</Link>
          </Text>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
