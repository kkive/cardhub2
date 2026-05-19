import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CopyOutlined,
  DownloadOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  TagOutlined,
} from '@ant-design/icons';
import {
  listCards,
  searchCards,
  listTags,
  getCard,
  exportCard,
  downloadExportBlob,
  createOrder,
  type CardItem,
  type Tag as TagType,
} from '@/services/api';

const { Title, Text, Paragraph } = Typography;

const sortOptions = [
  { label: '最新', value: 'newest' },
  { label: '热门', value: 'popular' },
  { label: '价格: 从低到高', value: 'price_asc' },
  { label: '价格: 从高到低', value: 'price_desc' },
];

const cardTypeOptions = [
  { label: '全部类型', value: '' },
  { label: '角色卡', value: 'character' },
  { label: '世界书', value: 'worldbook' },
  { label: '预设', value: 'preset' },
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

function highlightText(text: string, query: string) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} style={{ background: '#ffd54f', padding: 0 }}>{part}</mark>
    ) : (
      part
    ),
  );
}

const CardsPage: React.FC = () => {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [cardType, setCardType] = useState<string>('');
  const [sort, setSort] = useState('newest');

  const [tags, setTags] = useState<TagType[]>([]);

  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<string>('platform_json');
  const [downloading, setDownloading] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);

    const hasFilters = searchQuery || cardType || sort !== 'newest';
    const params = {
      q: searchQuery || undefined,
      cardType: cardType || undefined,
      sort,
      page,
      limit,
    };

    const { data, error: err } = hasFilters
      ? await searchCards(params)
      : await listCards(page, limit);

    if (err) {
      setError(err);
      setCards([]);
      setTotal(0);
    } else if (data) {
      setCards(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, limit, searchQuery, cardType, sort]);

  const fetchMeta = async () => {
    const { data } = await listTags();
    if (data) setTags(data);
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    const { data, error: err } = await getCard(id);
    if (err) {
      message.error(err);
      setDetailOpen(false);
    } else {
      setSelectedCard(data);
    }
    setDetailLoading(false);
  };

  const handleDownload = async () => {
    if (!selectedCard) return;
    setDownloading(true);
    try {
      const { data, error: err } = await exportCard(selectedCard.id, exportFormat as any);
      if (err) {
        message.error(err);
        return;
      }
      if (data) {
        const { blob, filename, error: dlErr } = await downloadExportBlob(data.id);
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

  const handlePurchase = async (cardId: string) => {
    setOrdering(true);
    try {
      const { data, error: err } = await createOrder(cardId, 'card');
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

  const renderCardItem = (card: CardItem) => (
    <Badge.Ribbon
      text={card.price > 0 ? formatPrice(card.price) : '免费'}
      color={card.price > 0 ? 'blue' : 'green'}
    >
      <Card
        hoverable
        onClick={() => openDetail(card.id)}
        style={{ height: '100%' }}
      >
        <Card.Meta
          title={highlightText(card.title, searchQuery)}
          description={
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Paragraph
                type="secondary"
                ellipsis={{ rows: 2 }}
                style={{ fontSize: 12, marginBottom: 0 }}
              >
                {highlightText(card.description || '暂无描述', searchQuery)}
              </Paragraph>
              <Space size={4} wrap>
                <Tag color={cardTypeColors[card.cardType] || 'default'} style={{ margin: 0 }}>
                  {cardTypeLabels[card.cardType] || card.cardType}
                </Tag>
                {card.tags?.slice(0, 2).map((t) => (
                  <Tag key={t} style={{ margin: 0 }}>
                    {t}
                  </Tag>
                ))}
              </Space>
              <Space size={16} style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                <span>
                  <DownloadOutlined /> {card.downloadCount}
                </span>
              </Space>
            </Space>
          }
        />
      </Card>
    </Badge.Ribbon>
  );

  const renderGrid = () => {
    if (cards.length === 0) {
      return (
        <Empty
          description={
            error
              ? '无法加载卡片，请检查 API 是否运行'
              : '未找到卡片'
          }
        />
      );
    }

    return (
      <Row gutter={[12, 12]}>
        {cards.map((card) => (
          <Col key={card.id} xs={24} sm={12} md={8} lg={6}>
            {renderCardItem(card)}
          </Col>
        ))}
      </Row>
    );
  };

  const filterContent = (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <div>
        <Text strong style={{ fontSize: 12, color: '#666' }}>卡片类型</Text>
        <Select
          placeholder="卡片类型"
          allowClear
          style={{ width: '100%', marginTop: 4 }}
          value={cardType || undefined}
          onChange={(v) => {
            setCardType(v || '');
            setPage(1);
          }}
          options={cardTypeOptions}
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
          setCardType('');
          setSort('newest');
          setSearchQuery('');
          setPage(1);
        }}
      >
        重置筛选
      </Button>
    </Space>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 12 }}>
        <TagOutlined /> 卡片市场
      </Title>

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
          placeholder="搜索卡片..."
          allowClear
          onSearch={handleSearch}
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
          onClick={() => fetchCards()}
          loading={loading}
        />
      </div>

      {/* Desktop inline filter bar */}
      <div className="desktop-filter-bar" style={{ marginBottom: 12, display: 'none' }}>
        <Space wrap>
          <Select
            placeholder="卡片类型"
            allowClear
            style={{ width: 140 }}
            value={cardType || undefined}
            onChange={(v) => {
              setCardType(v || '');
              setPage(1);
            }}
            options={cardTypeOptions}
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
            <Button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <Text>
              第 {page} / {Math.ceil(total / limit)} 页
            </Text>
            <Button
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage(page + 1)}
            >
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
        title={selectedCard?.title || '卡片详情'}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedCard(null);
        }}
        width="100%"
        className="card-detail-drawer"
        styles={{ body: { padding: 16 } }}
      >
        <Spin spinning={detailLoading}>
          {selectedCard && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>类型: </Text>
                <Tag color={cardTypeColors[selectedCard.cardType] || 'default'}>
                  {cardTypeLabels[selectedCard.cardType] || selectedCard.cardType}
                </Tag>
              </div>
              <div>
                <Text strong>价格: </Text>
                <Text
                  type={selectedCard.price === 0 ? 'success' : undefined}
                >
                  {formatPrice(selectedCard.price)}
                </Text>
              </div>
              <div>
                <Text strong>下载次数: </Text>
                <Text>{selectedCard.downloadCount}</Text>
              </div>
              {selectedCard.description && (
                <div>
                  <Text strong>描述</Text>
                  <Paragraph style={{ marginTop: 4 }}>
                    {selectedCard.description}
                  </Paragraph>
                </div>
              )}
              {selectedCard.content != null && typeof selectedCard.content === 'object' ? (
                <div>
                  <Space style={{ marginBottom: 8 }}>
                    <Text strong>卡片内容</Text>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(
                          JSON.stringify(selectedCard.content, null, 2),
                        ).then(() => {
                          message.success('已复制到剪贴板');
                        }).catch(() => {
                          message.error('复制失败');
                        });
                      }}
                    >
                      复制内容
                    </Button>
                  </Space>
                  <div style={{ maxHeight: 240, overflow: 'auto', marginTop: 8 }}>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {Object.entries(selectedCard.content as Record<string, unknown>).map(([key, value]) => (
                        <div key={key} style={{ background: '#f5f5f5', padding: '6px 10px', borderRadius: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>{key}: </Text>
                          <Text style={{ fontSize: 12 }}>
                            {typeof value === 'string' ? value : JSON.stringify(value)}
                          </Text>
                        </div>
                      ))}
                    </Space>
                  </div>
                </div>
              ) : null}

              {/* Download / Purchase section */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <Text strong>下载卡片</Text>
                <div style={{ marginTop: 8 }}>
                  <Select
                    value={exportFormat}
                    onChange={setExportFormat}
                    style={{ width: '100%', marginBottom: 8 }}
                    options={[
                      { label: 'Platform JSON', value: 'platform_json' },
                      { label: 'SillyTavern V2', value: 'sillytavern_v2' },
                      { label: 'TavernAI', value: 'tavernai' },
                    ]}
                  />
                  <Button
                    type="primary"
                    block
                    icon={<DownloadOutlined />}
                    loading={downloading}
                    onClick={handleDownload}
                    size="large"
                  >
                    下载
                  </Button>
                </div>
                {selectedCard.price > 0 && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      付费卡片需购买后才能下载
                    </Text>
                    <Button
                      block
                      icon={<ShoppingCartOutlined />}
                      loading={ordering}
                      onClick={() => handlePurchase(selectedCard.id)}
                      size="large"
                    >
                      创建订单 / 购买
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  创建于 {new Date(selectedCard.createdAt).toLocaleString()} | ID: {selectedCard.id}
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
          .card-detail-drawer .ant-drawer-content-wrapper {
            width: 520px !important;
            max-width: 80vw;
          }
        }
      `}</style>
    </div>
  );
};

export default CardsPage;
