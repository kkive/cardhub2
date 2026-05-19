import React, { useEffect, useMemo, useState } from 'react';
import { useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  List,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  OrderedListOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {
  getHealth,
  getBootstrapStatus,
  bootstrapAdmin,
  listTags,
  createTag,
  listUsers,
  updateUserRole,
  deleteUser,
  getConfig,
  updateConfig,
  getAuditConfig,
  updateAuditConfig,
  listAuditLogs,
  listAdminCards,
  listAdminCollections,
  listAdminOrders,
  createCard,
  updateCard,
  publishCard,
  unpublishCard,
  deleteCard,
  createCollection,
  updateCollection,
  publishCollection,
  unpublishCollection,
  deleteCollection,
  type HealthStatus,
  type AdminBootstrapStatus,
  type Tag as TagType,
  type Order,
  type UserItem,
  type AuditLogItem,
  type AuditConfigItem,
  type CardItem,
  type CollectionItem,
} from '@/services/api';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// ─────────────────────── helpers ───────────────────────

const cardTypeLabel: Record<string, string> = {
  character: '角色卡',
  worldbook: '世界书',
  preset: '预设',
};

const statusColor: Record<string, string> = {
  draft: 'default',
  published: 'green',
  paid: 'green',
  pending: 'orange',
  cancelled: 'red',
};

const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d;
  }
};

const fmtPrice = (v: number) =>
  v === 0 ? '免费' : `¥${(v / 100).toFixed(2)}`;

// ─────────────────────── Overview Tab ───────────────────────

const OverviewTab: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [bootstrap, setBootstrap] = useState<AdminBootstrapStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootForm] = Form.useForm();

  const fetchAll = async () => {
    setLoading(true);
    const [h, b] = await Promise.all([getHealth(), getBootstrapStatus()]);
    if (h.data) setHealth(h.data);
    if (b.data) setBootstrap(b.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleBootstrap = async (values: { email?: string; password?: string; confirmPassword?: string; token?: string }) => {
    if (!values.email || !values.password) {
      message.error('请输入邮箱和密码');
      return;
    }
    if (values.password.length < 8) {
      message.error('密码至少 8 位');
      return;
    }
    if (values.password !== values.confirmPassword) {
      message.error('两次密码不一致');
      return;
    }
    const { error } = await bootstrapAdmin({ email: values.email, password: values.password, token: values.token });
    if (error) message.error(error);
    else {
      message.success('管理员已创建，请登录');
      fetchAll();
    }
  };

  const checks = health?.checks ? Object.entries(health.checks) : [];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading} block>
        刷新
      </Button>

      <Spin spinning={loading}>
        {/* health */}
        <Card size="small">
          <Space align="center" style={{ marginBottom: 8 }}>
            <DatabaseOutlined />
            <Text strong>系统健康</Text>
            {health && (
              <Tag color={health.status === 'ok' ? 'success' : 'error'}>
                {health.status.toUpperCase()}
              </Tag>
            )}
          </Space>
          {checks.length > 0 ? (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {checks.map(([name, c]) => (
                <Space key={name} size={8}>
                  <Tag color={c.ok ? 'green' : 'red'}>{name}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {c.ok ? 'ok' : (c.error || 'error')}
                  </Text>
                </Space>
              ))}
            </Space>
          ) : (
            !loading && <Text type="secondary">暂无健康数据</Text>
          )}
        </Card>

        {/* bootstrap */}
        <Card size="small" style={{ marginTop: 12 }}>
          <Space align="center" style={{ marginBottom: 8 }}>
            <SafetyCertificateOutlined />
            <Text strong>管理员初始化</Text>
          </Space>
          {bootstrap?.hasAdmin ? (
            <Alert type="success" message="管理员已存在" showIcon banner />
          ) : (
            <Form form={bootForm} layout="vertical" onFinish={handleBootstrap} size="small">
              <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
                <Input placeholder="admin@example.com" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}>
                <Input.Password placeholder="设置管理员密码" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认密码"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('两次密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="再次输入密码" />
              </Form.Item>
              <Form.Item name="token" label="令牌 (可选)">
                <Input placeholder="初始化令牌" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SafetyCertificateOutlined />} block>
                  创建管理员
                </Button>
              </Form.Item>
            </Form>
          )}
        </Card>
      </Spin>
    </Space>
  );
};

// ─────────────────────── Cards Tab ───────────────────────

const CardsTab: React.FC = () => {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CardItem | null>(null);
  const [tags, setTags] = useState<TagType[]>([]);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const fetchCards = async (p = page) => {
    setLoading(true);
    const { data, error } = await listAdminCards({
      page: p,
      limit: 20,
      q: search || undefined,
      status: statusFilter || undefined,
      cardType: typeFilter || undefined,
    });
    if (error) message.error(error);
    else if (data) {
      setCards(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCards(1);
    listTags().then(({ data }) => {
      if (data) setTags(data);
    });
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ cardType: 'character', visibility: 'public', price: 0, content: '{}' });
    setDrawerOpen(true);
  };

  const openEdit = (card: CardItem) => {
    setEditing(card);
    form.setFieldsValue({
      title: card.title,
      description: card.description,
      cardType: card.cardType,
      visibility: card.visibility,
      price: card.price,
      tags: card.tags,
      content: card.content ? JSON.stringify(card.content, null, 2) : '{}',
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      let content: Record<string, unknown> = {};
      try {
        if (values.content) content = JSON.parse(values.content);
      } catch {
        message.error('内容必须是有效的 JSON');
        setSubmitting(false);
        return;
      }
      const payload = {
        title: values.title,
        description: values.description,
        content,
        cardType: values.cardType,
        visibility: values.visibility || 'public',
        price: values.price ?? 0,
        tags: values.tags,
      };
      if (editing) {
        const { error } = await updateCard(editing.id, payload);
        if (error) message.error(error);
        else {
          message.success('卡片已更新');
          setDrawerOpen(false);
          fetchCards();
        }
      } else {
        const { data, error } = await createCard(payload);
        if (error) message.error(error);
        else {
          message.success(`卡片 "${data?.title}" 已创建`);
          setDrawerOpen(false);
          fetchCards(1);
        }
      }
    } catch {
      // validation failed
    }
    setSubmitting(false);
  };

  const handlePublish = async (card: CardItem) => {
    const fn = card.status === 'published' ? unpublishCard : publishCard;
    const { error } = await fn(card.id);
    if (error) message.error(error);
    else {
      message.success(card.status === 'published' ? '已下架' : '已上架');
      fetchCards();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteCard(id);
    if (error) message.error(error);
    else {
      message.success('已删除');
      fetchCards();
    }
  };

  const handlePreview = (card: CardItem) => {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<pre style="white-space:pre-wrap;word-break:break-all;font-size:14px;">${JSON.stringify(card.content, null, 2)}</pre>`);
      w.document.title = card.title;
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Input.Search
          placeholder="搜索标题"
          allowClear
          onSearch={(v) => { setSearch(v); setPage(1); fetchCards(1); }}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 140px', minWidth: 0 }}
          size="small"
        />
        <Select
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); fetchCards(1); }}
          style={{ width: 90 }}
          size="small"
          options={[
            { label: '全部状态', value: '' },
            { label: '草稿', value: 'draft' },
            { label: '已发布', value: 'published' },
          ]}
        />
        <Select
          value={typeFilter}
          onChange={(v) => { setTypeFilter(v); setPage(1); fetchCards(1); }}
          style={{ width: 90 }}
          size="small"
          options={[
            { label: '全部类型', value: '' },
            { label: '角色卡', value: 'character' },
            { label: '世界书', value: 'worldbook' },
            { label: '预设', value: 'preset' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => fetchCards()} loading={loading} size="small">
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="small">
          新建
        </Button>
      </div>

      <Text type="secondary" style={{ fontSize: 12 }}>共 {total} 张卡片</Text>

      {/* list */}
      <Spin spinning={loading}>
        {cards.length === 0 && !loading ? (
          <Empty description="暂无卡片" />
        ) : (
          <List
            dataSource={cards}
            pagination={{
              current: page,
              pageSize: 20,
              total,
              onChange: (p) => { setPage(p); fetchCards(p); },
              size: 'small',
            }}
            renderItem={(card) => (
              <Card size="small" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong ellipsis={{ tooltip: card.title }} style={{ display: 'block' }}>
                      {card.title}
                    </Text>
                    <Space size={4} wrap style={{ marginTop: 4 }}>
                      <Tag>{cardTypeLabel[card.cardType] || card.cardType}</Tag>
                      <Tag color={statusColor[card.status] || 'default'}>{card.status === 'draft' ? '草稿' : '已发布'}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{fmtPrice(card.price)}</Text>
                    </Space>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                      下载 {card.downloadCount} &middot; {fmtDate(card.updatedAt)}
                    </div>
                  </div>
                </div>
                {/* actions row for mobile */}
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(card)}>
                    预览
                  </Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(card)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    icon={card.status === 'published' ? <UndoOutlined /> : <CloudUploadOutlined />}
                    onClick={() => handlePublish(card)}
                  >
                    {card.status === 'published' ? '下架' : '上架'}
                  </Button>
                  <Popconfirm
                    title="确认删除？"
                    description="此操作不可撤销"
                    onConfirm={() => handleDelete(card.id)}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </Card>
            )}
          />
        )}
      </Spin>

      {/* Drawer */}
      <Drawer
        title={editing ? '编辑卡片' : '新建卡片'}
        placement={isMobile ? 'bottom' : 'right'}
        height={isMobile ? '90vh' : undefined}
        width={isMobile ? '100%' : 480}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Button type="primary" onClick={handleSubmit} loading={submitting}>
            {editing ? '保存' : '创建'}
          </Button>
        }
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="卡片标题" />
          </Form.Item>
          <Form.Item name="cardType" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '角色卡', value: 'character' },
                { label: '世界书', value: 'worldbook' },
                { label: '预设', value: 'preset' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="简短描述" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="visibility" label="可见性">
                <Select
                  options={[
                    { label: '公开', value: 'public' },
                    { label: '不公开', value: 'unlisted' },
                    { label: '私有', value: 'private' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price" label="价格 (分)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              placeholder="选择或输入标签"
              options={tags.map((t) => ({ label: t.name, value: t.name }))}
            />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容 (JSON)"
            rules={[
              {
                validator: (_, v) => {
                  if (!v) return Promise.resolve();
                  try {
                    JSON.parse(v);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject('必须是有效的 JSON');
                  }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={isMobile ? 8 : 6}
              placeholder='{"personality":"...","scenario":"..."}'
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </Space>
  );
};

// ─────────────────────── Collections Tab ───────────────────────

const CollectionsTab: React.FC = () => {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionItem | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [allCards, setAllCards] = useState<CardItem[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const fetchCollections = async (p = page) => {
    setLoading(true);
    const { data, error } = await listAdminCollections({
      page: p,
      limit: 20,
      q: search || undefined,
      status: statusFilter || undefined,
    });
    if (error) message.error(error);
    else if (data) {
      setCollections(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  };

  const fetchAllCards = async () => {
    setCardsLoading(true);
    const { data, error } = await listAdminCards({ limit: 100 });
    if (!error && data) setAllCards(data.items);
    setCardsLoading(false);
  };

  useEffect(() => {
    fetchCollections(1);
    fetchAllCards();
  }, []);

  const characterCards = useMemo(() => allCards.filter((c) => c.cardType === 'character'), [allCards]);
  const worldbookCards = useMemo(() => allCards.filter((c) => c.cardType === 'worldbook'), [allCards]);
  const presetCards = useMemo(() => allCards.filter((c) => c.cardType === 'preset'), [allCards]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ price: 0 });
    setDrawerOpen(true);
  };

  const openEdit = (col: CollectionItem) => {
    setEditing(col);
    form.setFieldsValue({
      title: col.title,
      summary: col.summary,
      description: col.description,
      coverUrl: col.coverUrl,
      price: col.price,
      characterCardId: col.characterCardId,
      worldbookCardId: col.worldbookCardId,
      presetCardId: col.presetCardId,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        title: values.title,
        summary: values.summary,
        description: values.description,
        coverUrl: values.coverUrl,
        price: values.price ?? 0,
        characterCardId: values.characterCardId,
        worldbookCardId: values.worldbookCardId,
        presetCardId: values.presetCardId,
      };
      if (editing) {
        const { error } = await updateCollection(editing.id, payload);
        if (error) message.error(error);
        else {
          message.success('合集已更新');
          setDrawerOpen(false);
          fetchCollections();
        }
      } else {
        const { data, error } = await createCollection(payload);
        if (error) message.error(error);
        else {
          message.success(`合集 "${data?.title}" 已创建`);
          setDrawerOpen(false);
          fetchCollections(1);
        }
      }
    } catch {
      // validation failed
    }
    setSubmitting(false);
  };

  const handlePublish = async (col: CollectionItem) => {
    const fn = col.status === 'published' ? unpublishCollection : publishCollection;
    const { error } = await fn(col.id);
    if (error) message.error(error);
    else {
      message.success(col.status === 'published' ? '已下架' : '已上架');
      fetchCollections();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteCollection(id);
    if (error) message.error(error);
    else {
      message.success('已删除');
      fetchCollections();
    }
  };

  const handlePreview = (col: CollectionItem) => {
    const w = window.open('', '_blank');
    if (w) {
      const info = {
        title: col.title,
        summary: col.summary,
        description: col.description,
        characterCard: col.characterCard?.title,
        worldbookCard: col.worldbookCard?.title,
        presetCard: col.presetCard?.title,
        price: col.price,
      };
      w.document.write(`<pre style="white-space:pre-wrap;word-break:break-all;font-size:14px;">${JSON.stringify(info, null, 2)}</pre>`);
      w.document.title = col.title;
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Input.Search
          placeholder="搜索标题"
          allowClear
          onSearch={(v) => { setSearch(v); setPage(1); fetchCollections(1); }}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 140px', minWidth: 0 }}
          size="small"
        />
        <Select
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); fetchCollections(1); }}
          style={{ width: 90 }}
          size="small"
          options={[
            { label: '全部状态', value: '' },
            { label: '草稿', value: 'draft' },
            { label: '已发布', value: 'published' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => fetchCollections()} loading={loading} size="small">
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="small">
          新建
        </Button>
      </div>

      <Text type="secondary" style={{ fontSize: 12 }}>共 {total} 个合集</Text>

      <Spin spinning={loading}>
        {collections.length === 0 && !loading ? (
          <Empty description="暂无合集" />
        ) : (
          <List
            dataSource={collections}
            pagination={{
              current: page,
              pageSize: 20,
              total,
              onChange: (p) => { setPage(p); fetchCollections(p); },
              size: 'small',
            }}
            renderItem={(col) => (
              <Card size="small" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong ellipsis={{ tooltip: col.title }} style={{ display: 'block' }}>
                      {col.title}
                    </Text>
                    <Space size={4} wrap style={{ marginTop: 4 }}>
                      <Tag color={statusColor[col.status] || 'default'}>{col.status === 'draft' ? '草稿' : '已发布'}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{fmtPrice(col.price)}</Text>
                    </Space>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                      <div>角色卡: {col.characterCard?.title || '-'}</div>
                      <div>世界书: {col.worldbookCard?.title || '-'}</div>
                      <div>预设: {col.presetCard?.title || '-'}</div>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                      下载 {col.downloadCount} &middot; {fmtDate(col.updatedAt)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(col)}>
                    预览
                  </Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(col)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    icon={col.status === 'published' ? <UndoOutlined /> : <CloudUploadOutlined />}
                    onClick={() => handlePublish(col)}
                  >
                    {col.status === 'published' ? '下架' : '上架'}
                  </Button>
                  <Popconfirm
                    title="确认删除？"
                    description="此操作不可撤销"
                    onConfirm={() => handleDelete(col.id)}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </Card>
            )}
          />
        )}
      </Spin>

      {/* Drawer */}
      <Drawer
        title={editing ? '编辑合集' : '新建合集'}
        placement={isMobile ? 'bottom' : 'right'}
        height={isMobile ? '90vh' : undefined}
        width={isMobile ? '100%' : 480}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Button type="primary" onClick={handleSubmit} loading={submitting}>
            {editing ? '保存' : '创建'}
          </Button>
        }
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="合集标题" />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={2} placeholder="简短摘要" />
          </Form.Item>
          <Form.Item name="description" label="详细描述">
            <Input.TextArea rows={3} placeholder="详细描述" />
          </Form.Item>
          <Form.Item name="coverUrl" label="封面 URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="price" label="价格 (分)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Divider orientation="left" style={{ fontSize: 13 }}>三件套选择</Divider>
          <Spin spinning={cardsLoading}>
            <Form.Item name="characterCardId" label="角色卡" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="选择角色卡"
                optionFilterProp="label"
                options={characterCards.map((c) => ({
                  label: `${c.title} (${c.status === 'published' ? '已发布' : '草稿'})`,
                  value: c.id,
                }))}
              />
            </Form.Item>
            <Form.Item name="worldbookCardId" label="世界书" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="选择世界书"
                optionFilterProp="label"
                options={worldbookCards.map((c) => ({
                  label: `${c.title} (${c.status === 'published' ? '已发布' : '草稿'})`,
                  value: c.id,
                }))}
              />
            </Form.Item>
            <Form.Item name="presetCardId" label="预设" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="选择预设"
                optionFilterProp="label"
                options={presetCards.map((c) => ({
                  label: `${c.title} (${c.status === 'published' ? '已发布' : '草稿'})`,
                  value: c.id,
                }))}
              />
            </Form.Item>
          </Spin>
        </Form>
      </Drawer>
    </Space>
  );
};

// ─────────────────────── Orders Tab ───────────────────────

const OrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');

  const fetchOrders = async (p = page) => {
    setLoading(true);
    const { data, error } = await listAdminOrders({
      page: p,
      limit: 20,
      status: statusFilter || undefined,
      targetType: targetFilter || undefined,
    });
    if (error) message.error(error);
    else if (data) {
      setOrders(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders(1);
  }, []);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Select
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); fetchOrders(1); }}
          style={{ width: 90 }}
          size="small"
          options={[
            { label: '全部状态', value: '' },
            { label: '待支付', value: 'pending' },
            { label: '已支付', value: 'paid' },
            { label: '已取消', value: 'cancelled' },
          ]}
        />
        <Select
          value={targetFilter}
          onChange={(v) => { setTargetFilter(v); setPage(1); fetchOrders(1); }}
          style={{ width: 90 }}
          size="small"
          options={[
            { label: '全部类型', value: '' },
            { label: '卡片', value: 'card' },
            { label: '合集', value: 'collection' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => fetchOrders()} loading={loading} size="small">
          刷新
        </Button>
      </div>

      <Text type="secondary" style={{ fontSize: 12 }}>共 {total} 笔订单</Text>

      <Spin spinning={loading}>
        {orders.length === 0 && !loading ? (
          <Empty description="暂无订单" />
        ) : (
          <List
            dataSource={orders}
            pagination={{
              current: page,
              pageSize: 20,
              total,
              onChange: (p) => { setPage(p); fetchOrders(p); },
              size: 'small',
            }}
            renderItem={(order) => {
              const targetTitle =
                order.targetType === 'collection'
                  ? order.collection?.title || order.collectionId
                  : order.card?.title || order.cardId;
              return (
                <Card size="small" style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                    {order.id.slice(0, 8)}... &middot; {fmtDate(order.createdAt)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong ellipsis style={{ display: 'block' }}>
                        {targetTitle || '-'}
                      </Text>
                      <Space size={4} wrap style={{ marginTop: 4 }}>
                        <Tag>{order.targetType === 'collection' ? '合集' : '卡片'}</Tag>
                        <Tag color={statusColor[order.status] || 'default'}>{order.status}</Tag>
                      </Space>
                    </div>
                    <Text strong style={{ color: '#f5222d', whiteSpace: 'nowrap' }}>
                      {fmtPrice(order.amount)}
                    </Text>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                    用户: {order.userId.slice(0, 8)}...
                  </div>
                </Card>
              );
            }}
          />
        )}
      </Spin>
    </Space>
  );
};

// ─────────────────────── Config Tab ───────────────────────

const TagsSection: React.FC = () => {
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(false);
  const [tagName, setTagName] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchTags = async () => {
    setLoading(true);
    const { data } = await listTags();
    if (data) setTags(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleAdd = async () => {
    if (!tagName.trim()) return;
    setAdding(true);
    const { error } = await createTag({ name: tagName.trim() });
    if (error) message.error(error);
    else {
      message.success('标签已创建');
      setTagName('');
      fetchTags();
    }
    setAdding(false);
  };

  return (
    <Card size="small" title="标签管理">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Input
          size="small"
          placeholder="新标签名称"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          onPressEnter={handleAdd}
          style={{ flex: 1 }}
        />
        <Button size="small" type="primary" icon={<PlusOutlined />} loading={adding} onClick={handleAdd}>
          添加
        </Button>
      </div>
      <Spin spinning={loading}>
        {tags.length === 0 ? (
          <Text type="secondary">暂无标签</Text>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.map((t) => (
              <Tag key={t.id}>
                {t.name}
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                  ({t._count?.cards ?? 0})
                </Text>
              </Tag>
            ))}
          </div>
        )}
      </Spin>
    </Card>
  );
};

const UsersSection: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const { initialState } = useModel('@@initialState');
  const currentUserId = initialState?.currentUser?.id;

  const fetchUsers = async (p = page) => {
    setLoading(true);
    const { data, error } = await listUsers(p, 20);
    if (error) message.error(error);
    else if (data) {
      setUsers(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers(1);
  }, []);

  const handleRoleChange = async (id: string, role: 'user' | 'admin') => {
    const { error } = await updateUserRole(id, role);
    if (error) message.error(error);
    else {
      message.success('角色已更新');
      fetchUsers();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteUser(id);
    if (error) message.error(error);
    else {
      message.success('用户已删除');
      fetchUsers();
    }
  };

  return (
    <Card size="small" title="用户管理" extra={
      <Button icon={<ReloadOutlined />} onClick={() => fetchUsers()} loading={loading} size="small">
        刷新
      </Button>
    }>
      <Spin spinning={loading}>
        {users.length === 0 && !loading ? (
          <Text type="secondary">暂无用户</Text>
        ) : (
          <List
            dataSource={users}
            pagination={{
              current: page,
              pageSize: 20,
              total,
              onChange: (p) => { setPage(p); fetchUsers(p); },
              size: 'small',
            }}
            renderItem={(user) => {
              const isSelf = user.id === currentUserId;
              return (
                <Card size="small" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong ellipsis style={{ display: 'block' }}>{user.username || user.email}</Text>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {user.email} &middot; {fmtDate(user.createdAt)}
                      </div>
                    </div>
                    <Space size={4}>
                      <Select
                        value={user.role}
                        size="small"
                        style={{ width: 80 }}
                        disabled={isSelf}
                        onChange={(v) => handleRoleChange(user.id, v as 'admin' | 'user')}
                        options={[
                          { label: '用户', value: 'user' },
                          { label: '管理员', value: 'admin' },
                        ]}
                      />
                      {!isSelf && (
                        <Popconfirm
                          title="确认删除？"
                          description="此操作不可撤销"
                          onConfirm={() => handleDelete(user.id)}
                          okText="删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                        >
                          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                        </Popconfirm>
                      )}
                    </Space>
                  </div>
                </Card>
              );
            }}
          />
        )}
      </Spin>
    </Card>
  );
};

const SystemConfigSection: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await getConfig();
    if (data) form.setFieldsValue(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (values: Record<string, string>) => {
    setSaving(true);
    const { error } = await updateConfig(values);
    if (error) message.error(error);
    else message.success('配置已保存');
    setSaving(false);
  };

  return (
    <Card size="small" title="系统配置">
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" onFinish={handleSave} size="small">
          <Divider orientation="left" style={{ fontSize: 13 }}>Stripe</Divider>
          <Form.Item name="STRIPE_SECRET_KEY" label="Secret Key">
            <Input.Password placeholder="sk_..." />
          </Form.Item>
          <Form.Item name="STRIPE_WEBHOOK_SECRET" label="Webhook Secret">
            <Input.Password placeholder="whsec_..." />
          </Form.Item>
          <Divider orientation="left" style={{ fontSize: 13 }}>YiPay</Divider>
          <Form.Item name="YIPAY_SECRET" label="YiPay Secret">
            <Input.Password placeholder="YiPay 密钥" />
          </Form.Item>
          <Divider orientation="left" style={{ fontSize: 13 }}>易支付</Divider>
          <Form.Item name="EPAY_PID" label="商户ID">
            <Input placeholder="易支付商户ID" />
          </Form.Item>
          <Form.Item name="EPAY_KEY" label="商户密钥">
            <Input.Password placeholder="易支付商户密钥" />
          </Form.Item>
          <Form.Item name="EPAY_GATEWAY" label="支付网关">
            <Input placeholder="https://pay.example.com" />
          </Form.Item>
          <Divider orientation="left" style={{ fontSize: 13 }}>基础</Divider>
          <Form.Item name="BASE_URL" label="站点 URL">
            <Input placeholder="https://your-site.com" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} block>
              保存配置
            </Button>
          </Form.Item>
        </Form>
      </Spin>
    </Card>
  );
};

const ConfigTab: React.FC = () => (
  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
    <OverviewTab />
    <TagsSection />
    <UsersSection />
    <SystemConfigSection />
  </Space>
);

// ─────────────────────── Audit Tab ───────────────────────

const AuditTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [config, setConfig] = useState<AuditConfigItem[]>([]);
  const [configLoading, setConfigLoading] = useState(false);

  const fetchLogs = async (p = page) => {
    setLoading(true);
    const { data, error } = await listAuditLogs({
      page: p,
      limit: 20,
      action: actionFilter || undefined,
    });
    if (error) message.error(error);
    else if (data) {
      setLogs(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  };

  const fetchConfig = async () => {
    setConfigLoading(true);
    const { data } = await getAuditConfig();
    if (data) setConfig(data);
    setConfigLoading(false);
  };

  useEffect(() => {
    fetchLogs(1);
    fetchConfig();
  }, []);

  const handleToggle = async (key: string, enabled: boolean) => {
    const { error } = await updateAuditConfig(key, enabled);
    if (error) message.error(error);
    else setConfig((prev) => prev.map((c) => (c.key === key ? { ...c, enabled } : c)));
  };

  const actionOptions = [
    { label: '全部', value: '' },
    { label: '登录', value: 'user.login' },
    { label: '注册', value: 'user.register' },
    { label: '删除用户', value: 'user.delete' },
    { label: '修改角色', value: 'user.role_change' },
    { label: '创建卡片', value: 'card.create' },
    { label: '更新卡片', value: 'card.update' },
    { label: '删除卡片', value: 'card.delete' },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* config toggles */}
      <Card size="small" title="日志配置">
        <Spin spinning={configLoading}>
          {config.length === 0 && !configLoading ? (
            <Text type="secondary">暂无配置项</Text>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {config.map((c) => (
                <Space key={c.key} size={4}>
                  <Text style={{ fontSize: 12 }}>{c.key}</Text>
                  <Switch size="small" checked={c.enabled} onChange={(v) => handleToggle(c.key, v)} />
                </Space>
              ))}
            </div>
          )}
        </Spin>
      </Card>

      {/* filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Select
          value={actionFilter}
          onChange={(v) => { setActionFilter(v); setPage(1); fetchLogs(1); }}
          style={{ flex: '1 1 120px', minWidth: 0 }}
          size="small"
          options={actionOptions}
        />
        <Button icon={<ReloadOutlined />} onClick={() => fetchLogs()} loading={loading} size="small">
          刷新
        </Button>
      </div>

      <Text type="secondary" style={{ fontSize: 12 }}>共 {total} 条日志</Text>

      {/* log list */}
      <Spin spinning={loading}>
        {logs.length === 0 && !loading ? (
          <Empty description="暂无日志" />
        ) : (
          <List
            dataSource={logs}
            pagination={{
              current: page,
              pageSize: 20,
              total,
              onChange: (p) => { setPage(p); fetchLogs(p); },
              size: 'small',
            }}
            renderItem={(log) => (
              <Card size="small" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Space size={4} wrap>
                    <Tag>{log.action}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {log.username || log.userId || '-'}
                    </Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    {fmtDate(log.createdAt)}
                  </Text>
                </div>
                {log.target && (
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    目标: {log.target}
                  </div>
                )}
                {log.detail != null ? (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {typeof log.detail === 'string' ? log.detail : JSON.stringify(log.detail)}
                  </div>
                ) : null}
              </Card>
            )}
          />
        )}
      </Spin>
    </Space>
  );
};

// ─────────────────────── Main Admin Page ───────────────────────

const AdminPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  return (
    <div style={{ maxWidth: isMobile ? '100%' : 960, margin: '0 auto', padding: isMobile ? '8px 8px 64px' : '0 16px' }}>
      <Title level={4} style={{ marginBottom: 16, fontSize: isMobile ? 18 : undefined }}>
        <SettingOutlined /> 管理控制台
      </Title>

      <Tabs
        defaultActiveKey="overview"
        tabBarGutter={isMobile ? 8 : 16}
        style={{ overflow: 'hidden' }}
        items={[
          {
            key: 'overview',
            label: (
              <span>
                <BarChartOutlined /> {isMobile ? '概览' : '概览'}
              </span>
            ),
            children: <OverviewTab />,
          },
          {
            key: 'cards',
            label: (
              <span>
                <CloudUploadOutlined /> {isMobile ? '卡片' : '卡片'}
              </span>
            ),
            children: <CardsTab />,
          },
          {
            key: 'collections',
            label: (
              <span>
                <AppstoreOutlined /> {isMobile ? '合集' : '合集'}
              </span>
            ),
            children: <CollectionsTab />,
          },
          {
            key: 'orders',
            label: (
              <span>
                <OrderedListOutlined /> {isMobile ? '订单' : '订单'}
              </span>
            ),
            children: <OrdersTab />,
          },
          {
            key: 'config',
            label: (
              <span>
                <SettingOutlined /> {isMobile ? '配置' : '配置'}
              </span>
            ),
            children: <ConfigTab />,
          },
          {
            key: 'audit',
            label: (
              <span>
                <AuditOutlined /> {isMobile ? '审计' : '审计'}
              </span>
            ),
            children: <AuditTab />,
          },
        ]}
      />
    </div>
  );
};

export default AdminPage;
