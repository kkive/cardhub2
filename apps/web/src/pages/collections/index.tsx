import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Input,
  message,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  DownloadOutlined,
  FilterOutlined,
  GiftOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import {
  listCollections,
  getCollection,
  exportCollection,
  downloadCollectionExportBlob,
  createOrder,
  type CollectionItem,
} from '@/services/api';
import { history, useModel } from '@umijs/max';

const { Title, Text, Paragraph } = Typography;

const sortOptions = [
  { label: '最新', value: 'newest' },
  { label: '热门', value: 'popular' },
  { label: '价格: 从低到高', value: 'price_asc' },
  { label: '价格: 从高到低', value: 'price_desc' },
];

const priceFilterOptions = [
  { label: '全部价格', value: 'all' },
  { label: '免费', value: 'free' },
  { label: '付费', value: 'paid' },
];

const cardTypeColors: Record<string, string> = {
  character: 'blue',
  worldbook: 'green',
  preset: 'orange',
};

const cardTypeLabels: Record<string, string> = {
  character: '角色卡',
  worldbook: '世界书',
  preset: '预设',
};

function formatPrice(cents: number) {
  if (cents === 0) return '免费';
  return `$${(cents / 100).toFixed(2)}`;
}

const CollectionsPage: React.FC = () => {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [sort, setSort] = useState('newest');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected] = useState<CollectionItem | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [collectionExportFormat, setCollectionExportFormat] = useState<string>('platform_json');

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const { initialState } = useModel('@@initialState');
  const isAdmin = initialState?.currentUser?.role === 'admin';

  const fetchCollections = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);

    const params: Record<string, any> = {
      page: p,
      limit,
      sort,
    };
    if (searchQuery) params.q = searchQuery;
    if (priceFilter === 'free') {
      params.priceMax = 0;
    } else if (priceFilter === 'paid') {
      params.priceMin = 1;
    }

    const { data, error: err } = await listCollections(params);
    if (err) {
      setError(err);
      setCollections([]);
      setTotal(0);
    } else if (data) {
      setCollections(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, limit, searchQuery, priceFilter, sort]);

  useEffect(() => {
    fetchCollections(1);
  }, [fetchCollections]);

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    const { data, error: err } = await getCollection(id);
    if (err) {
      message.error(err);
      setDetailOpen(false);
    } else {
      setSelected(data);
    }
    setDetailLoading(false);
  };

  const handleDownload = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      const { data, error: err } = await exportCollection(selected.id, collectionExportFormat as any);
      if (err) {
        message.error(err);
        return;
      }
      if (data) {
        const { blob, filename, error: dlErr } = await downloadCollectionExportBlob(data.id);
        if (dlErr) {
          message.error(dlErr);
        } else if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          message.success('下载已开始');
        }
      }
    } catch {
      message.error('下载失败');
    } finally {
      setDownloading(false);
    }
  };

  const handlePurchase = async (collectionId: string) => {
    setOrdering(true);
    try {
      const { data, error: err } = await createOrder(collectionId, 'collection');
      if (err) {
        message.error(err);
      } else if (data) {
        message.success(`订单已创建 (ID: ${data.id})，请前往支付`);
      }
    } catch {
      message.error('创建订单失败');
    } finally {
      setOrdering(false);
    }
  };

  const renderSubCard = (card: { id: string; title: string; description: string | null; cardType: string; price: number; downloadCount: number } | undefined, label: string) => {
    if (!card) return null;
    return (
      <Card size="small" style={{ marginBottom: 8 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space>
            <Tag color={cardTypeColors[card.cardType] || 'default'}>
              {label}
            </Tag>
            <Text strong style={{ fontSize: 13 }}>{card.title}</Text>
          </Space>
          {card.description && (
            <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }} ellipsis={{ rows: 1 }}>
              {card.description}
            </Paragraph>
          )}
          <Text type="secondary" style={{ fontSize: 11 }}>
            {formatPrice(card.price)} | 下载 {card.downloadCount}
          </Text>
        </Space>
      </Card>
    );
  };

  const renderCollectionCard = (col: CollectionItem) => (
    <Card
      hoverable
      onClick={() => openDetail(col.id)}
      style={{ height: '100%' }}
    >
      <Card.Meta
        title={
          <Space>
            <span>{col.title}</span>
            {col.price > 0 ? (
              <Tag color="blue">{formatPrice(col.price)}</Tag>
            ) : (
              <Tag color="green">免费</Tag>
            )}
          </Space>
        }
        description={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {col.description && (
              <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: 12, marginBottom: 0 }}>
                {col.description}
              </Paragraph>
            )}
            <Space size={4} wrap>
              {col.characterCard && (
                <Tag color="blue" style={{ margin: 0 }}>
                  {cardTypeLabels.character}: {col.characterCard.title}
                </Tag>
              )}
              {col.worldbookCard && (
                <Tag color="green" style={{ margin: 0 }}>
                  {cardTypeLabels.worldbook}: {col.worldbookCard.title}
                </Tag>
              )}
              {col.presetCard && (
                <Tag color="orange" style={{ margin: 0 }}>
                  {cardTypeLabels.preset}: {col.presetCard.title}
                </Tag>
              )}
            </Space>
            <Space size={16} style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
              <span>
                <DownloadOutlined /> {col.downloadCount}
              </span>
            </Space>
          </Space>
        }
      />
    </Card>
  );

  const renderGrid = () => {
    if (collections.length === 0) {
      return (
        <Empty
          description={
            error
              ? '无法加载合集，请检查 API 是否运行'
              : '暂无合集'
          }
        />
      );
    }

    return (
      <Row gutter={[12, 12]}>
        {collections.map((col) => (
          <Col key={col.id} xs={24} sm={12} md={8} lg={6}>
            {renderCollectionCard(col)}
          </Col>
        ))}
      </Row>
    );
  };

  const filterContent = (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <div>
        <Text strong style={{ fontSize: 12, color: '#666' }}>价格筛选</Text>
        <Select
          style={{ width: '100%', marginTop: 4 }}
          value={priceFilter}
          onChange={(v) => {
            setPriceFilter(v);
            setPage(1);
          }}
          options={priceFilterOptions}
        />
      </div>
      <div>
        <Text strong style={{ fontSize: 12, color: '#666' }}>排序</Text>
        <Select
          style={{ width: '100%', marginTop: 4 }}
          value={sort}
          onChange={setSort}
          options={sortOptions}
        />
      </div>
      <Button
        block
        onClick={() => {
          setSearchQuery('');
          setPriceFilter('all');
          setSort('newest');
          setPage(1);
        }}
      >
        重置筛选
      </Button>
    </Space>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>
          <GiftOutlined /> 合集市场
        </Title>
        {isAdmin && (
          <Button
            icon={<SettingOutlined />}
            onClick={() => history.push('/admin')}
            size="small"
          >
            去管理
          </Button>
        )}
      </div>

      {error && (
        <Alert
          type="warning"
          message="API 不可达"
          description={error}
          showIcon
          closable
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Search bar + filter button */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Input.Search
          placeholder="搜索合集..."
          allowClear
          onSearch={(v) => {
            setSearchQuery(v);
            setPage(1);
          }}
          style={{ flex: 1 }}
          enterButton={<SearchOutlined />}
        />
        <Button
          icon={<FilterOutlined />}
          onClick={() => setFilterDrawerOpen(true)}
        >
          筛选
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchCollections()}
          loading={loading}
        />
      </div>

      {/* Desktop inline filter bar */}
      <div className="desktop-filter-bar" style={{ marginBottom: 12, display: 'none' }}>
        <Space wrap>
          <Select
            style={{ width: 140 }}
            value={priceFilter}
            onChange={(v) => {
              setPriceFilter(v);
              setPage(1);
            }}
            options={priceFilterOptions}
          />
          <Select
            style={{ width: 160 }}
            value={sort}
            onChange={setSort}
            options={sortOptions}
          />
        </Space>
      </div>

      <Spin spinning={loading}>
        {renderGrid()}
      </Spin>

      {total > limit && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Space>
            <Button disabled={page <= 1} onClick={() => { setPage(page - 1); fetchCollections(page - 1); }}>
              上一页
            </Button>
            <Text>第 {page} / {Math.ceil(total / limit)} 页</Text>
            <Button disabled={page >= Math.ceil(total / limit)} onClick={() => { setPage(page + 1); fetchCollections(page + 1); }}>
              下一页
            </Button>
          </Space>
        </div>
      )}

      {/* Mobile filter drawer */}
      <Drawer
        title="筛选"
        placement="bottom"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        height="auto"
        styles={{ body: { paddingBottom: 24 } }}
      >
        {filterContent}
        <Button
          type="primary"
          block
          style={{ marginTop: 12 }}
          onClick={() => setFilterDrawerOpen(false)}
        >
          应用筛选
        </Button>
      </Drawer>

      {/* Detail drawer */}
      <Drawer
        title={selected?.title || '合集详情'}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelected(null);
        }}
        width="100%"
        className="collection-detail-drawer"
        styles={{ body: { padding: 16 } }}
      >
        <Spin spinning={detailLoading}>
          {selected && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>价格: </Text>
                <Text type={selected.price === 0 ? 'success' : undefined}>
                  {formatPrice(selected.price)}
                </Text>
              </div>
              <div>
                <Text strong>下载次数: </Text>
                <Text>{selected.downloadCount}</Text>
              </div>
              {selected.description && (
                <div>
                  <Text strong>描述</Text>
                  <Paragraph style={{ marginTop: 4 }}>
                    {selected.description}
                  </Paragraph>
                </div>
              )}

              {/* Three-piece display */}
              <div>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>合集内容</Text>
                {renderSubCard(selected.characterCard, '角色卡')}
                {renderSubCard(selected.worldbookCard, '世界书')}
                {renderSubCard(selected.presetCard, '预设')}
              </div>

              {/* Download / Purchase section */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <Text strong>导出下载整个合集</Text>
                <div style={{ marginTop: 8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>导出格式</Text>
                    <Select
                      style={{ width: '100%', marginTop: 4 }}
                      value={collectionExportFormat}
                      onChange={setCollectionExportFormat}
                      options={[
                        { label: 'Platform JSON', value: 'platform_json' },
                        { label: 'SillyTavern V2', value: 'sillytavern_v2' },
                        { label: 'TavernAI', value: 'tavernai' },
                      ]}
                    />
                  </div>
                  <Button
                    type="primary"
                    block
                    icon={<DownloadOutlined />}
                    loading={downloading}
                    onClick={handleDownload}
                    size="large"
                  >
                    下载合集 (ZIP)
                  </Button>
                </div>
                {selected.price > 0 && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      付费合集需购买后才能下载
                    </Text>
                    <Button
                      block
                      icon={<ShoppingCartOutlined />}
                      loading={ordering}
                      onClick={() => handlePurchase(selected.id)}
                      size="large"
                    >
                      创建订单 / 购买
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  创建于 {new Date(selected.createdAt).toLocaleString()} | ID: {selected.id}
                </Text>
              </div>
            </Space>
          )}
        </Spin>
      </Drawer>

      <style>{`
        .desktop-filter-bar { display: none; }
        @media (min-width: 768px) {
          .desktop-filter-bar { display: block; }
          .collection-detail-drawer .ant-drawer-content-wrapper {
            width: 520px !important;
            max-width: 80vw;
          }
        }
      `}</style>
    </div>
  );
};

export default CollectionsPage;
