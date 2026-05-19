import React, { useState } from 'react';
import { Outlet, useLocation, history, useModel } from '@umijs/max';
import { Layout, Menu, Button, Space, Typography, Drawer } from 'antd';
import {
  AppstoreOutlined,
  GiftOutlined,
  SettingOutlined,
  LoginOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Text } = Typography;

const BasicLayout: React.FC = () => {
  const location = useLocation();
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const isAdmin = currentUser?.role === 'admin';
  const [drawerOpen, setDrawerOpen] = useState(false);

  const menuItems = [
    { key: '/cards', icon: <AppstoreOutlined />, label: '卡片' },
    { key: '/collections', icon: <GiftOutlined />, label: '合集' },
  ];

  const selectedKey =
    menuItems.find((item) => location.pathname.startsWith(item.key))?.key ||
    '/cards';

  const handleLogout = () => {
    localStorage.removeItem('token');
    history.push('/login');
    window.location.reload();
  };

  const navigateTo = (path: string) => {
    history.push(path);
    setDrawerOpen(false);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          height: 48,
          lineHeight: '48px',
          width: '100%',
          maxWidth: '100vw',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            color: '#1677ff',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onClick={() => history.push('/cards')}
        >
          Cards hub
        </div>

        {/* Desktop nav */}
        <div className="desktop-nav" style={{ flex: 1, minWidth: 0, marginLeft: 24 }}>
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => history.push(key)}
            style={{ borderBottom: 'none', minWidth: 0 }}
          />
        </div>

        {/* Desktop auth */}
        <div className="desktop-auth" style={{ flexShrink: 0 }}>
          {currentUser ? (
            <Space size={4}>
              <Button
                type="text"
                size="small"
                icon={<UserOutlined />}
                onClick={() => {}}
              >
                {currentUser.username}
              </Button>
              {isAdmin && (
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => history.push('/admin')}
                >
                  管理
                </Button>
              )}
              <Button
                type="text"
                size="small"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
              />
            </Space>
          ) : (
            <Space size={4}>
              <Button type="text" size="small" onClick={() => history.push('/login')}>
                登录
              </Button>
              <Button type="primary" size="small" onClick={() => history.push('/register')}>
                注册
              </Button>
            </Space>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="mobile-menu-btn" style={{ marginLeft: 'auto' }}>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ fontSize: 18 }}
          />
        </div>
      </Header>

      <Drawer
        placement="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={260}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigateTo(key)}
          style={{ border: 'none' }}
        />
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 16px' }}>
          {currentUser ? (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text>
                <UserOutlined /> {currentUser.username}
                {isAdmin && (
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                    (管理员)
                  </Text>
                )}
              </Text>
              {isAdmin && (
                <Button
                  block
                  icon={<SettingOutlined />}
                  onClick={() => navigateTo('/admin')}
                >
                  管理控制台
                </Button>
              )}
              <Button block icon={<LogoutOutlined />} onClick={handleLogout}>
                退出登录
              </Button>
            </Space>
          ) : (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Button block type="primary" onClick={() => navigateTo('/login')}>
                登录
              </Button>
              <Button block onClick={() => navigateTo('/register')}>
                注册
              </Button>
            </Space>
          )}
        </div>
      </Drawer>

      <Content
        style={{
          padding: '12px 8px',
          maxWidth: '100vw',
          overflow: 'hidden',
        }}
      >
        <Outlet />
      </Content>

      <style>{`
        .desktop-nav, .desktop-auth { display: flex; }
        .mobile-menu-btn { display: none; }
        @media (max-width: 640px) {
          .desktop-nav, .desktop-auth { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </Layout>
  );
};

export default BasicLayout;
