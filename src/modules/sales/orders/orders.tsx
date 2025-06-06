import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Input,
  Button,
  Layout,
  Modal,
  Form,
  Select,
  DatePicker,
  InputNumber,
  message,
  Tag,
  type FormInstance,
} from "antd";
import {
  SearchOutlined,
  DeleteOutlined,
  PlusOutlined,
  FileExcelOutlined,
  EditOutlined,
  TagOutlined,
} from "@ant-design/icons";
import type { ColumnType } from "antd/es/table";
import moment from "moment";

const { Header, Content } = Layout;
const { Option } = Select;

type ICustomer = Window["types"]["Customer"];
type IProduct = Window["types"]["Product"];
type ISalesOrder = Window["types"]["SalesOrder"];
type ISalesOrderProduct = Window["types"]["SalesOrder"]["products"][number];

const SalesOrderPage = () => {
  const [salesOrders, setSalesOrders] = useState<ISalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingSalesOrder, setEditingSalesOrder] =
    useState<ISalesOrder | null>(null);
  const [selectedSalesOrderKeys, setSelectedSalesOrderKeys] = useState<
    React.Key[]
  >([]);
  const [searchText, setSearchText] = useState("");
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // --- Fetch Data ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const orders = await window.api.getSalesOrders();
      const customersData = await window.api.getCustomers();
      const productsData = await window.api.getProducts();

      // Convert date strings to Date objects.  Crucial for DatePicker and consistency.
      const formattedOrders = orders.map((order: any) => ({
        ...order.dataValues,
        orderDate: new Date(order.dataValues.orderDate),
      }));

      setSalesOrders(formattedOrders);
      setCustomers(customersData.map((c: any) => c.dataValues));
      setProducts(productsData.map((p: any) => p.dataValues));
    } catch (error) {
      console.error("Failed to fetch data:", error);
      message.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Helper Functions ---
  const getCustomerName = (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer ? customer.name : "Unknown Customer";
  };

  const getProductName = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    return product ? product.name : "Unknown Product";
  };

  const calculateTotalPrice = (products: ISalesOrderProduct[]): number => {
    return products.reduce(
      (total, product) => total + product.quantity * product.price,
      0
    );
  };

  // --- Search ---
  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const filteredSalesOrders = salesOrders.filter((order) => {
    const customerName = getCustomerName(order.customerId).toLowerCase();
    const orderDate = moment(order.orderDate).format("YYYY-MM-DD"); // Format for comparison
    const productNames = order.products
      .map((p) => getProductName(p.product_id).toLowerCase())
      .join(", ");

    return (
      customerName.includes(searchText.toLowerCase()) ||
      orderDate.includes(searchText) ||
      productNames.includes(searchText.toLowerCase())
    );
  });

  // --- Add ---
  const showAddModal = () => {
    setIsAddModalVisible(true);
    setEditingSalesOrder(null);
  };
  const handleAddCancel = () => {
    setIsAddModalVisible(false);
    form.resetFields();
  };

  const handleAddOk = async () => {
    try {
      const values = await form.validateFields();

      // Convert the date using moment
      const orderDate = moment(values.orderDate).toDate();

      const newOrder: Omit<ISalesOrder, "id" | "createdAt" | "updatedAt"> = {
        customerId: values.customerId,
        orderDate: orderDate,
        products: values.products.map((p: any) => ({
          product_id: p.product_id,
          quantity: p.quantity,
          price: p.price,
        })),
        totalAmount: calculateTotalPrice(
          values.products.map((p: any) => ({
            product_id: p.product_id,
            quantity: p.quantity,
            price: p.price,
          }))
        ),
        status: values.status,
      };

      await window.api.addSalesOrder(newOrder);
      await fetchData();

      setIsAddModalVisible(false);
      form.resetFields();
      message.success("Sales Order added successfully.");
    } catch (error) {
      console.error("Failed to add sales order:", error);
      message.error("Failed to add sales order.");
    }
  };

  // --- Edit ---
  const showEditModal = (record: ISalesOrder) => {
    setEditingSalesOrder(record);

    // Format the date for the DatePicker
    editForm.setFieldsValue({
      ...record,
      orderDate: moment(record.orderDate),
    });
    setIsEditModalVisible(true);
  };

  const handleEditCancel = () => {
    setIsEditModalVisible(false);
    editForm.resetFields();
  };

  const handleEditOk = async () => {
    try {
      if (!editingSalesOrder?.id) return;
      const values = await editForm.validateFields();

      const updatedOrder: Omit<ISalesOrder, "id" | "createdAt" | "updatedAt"> =
        {
          customerId: values.customerId,
          orderDate: values.orderDate.toDate(),
          products: values.products.map((p: any) => ({
            product_id: p.product_id,
            quantity: p.quantity,
            price: p.price,
          })),
          totalAmount: calculateTotalPrice(
            values.products.map((p: any) => ({
              product_id: p.product_id,
              quantity: p.quantity,
              price: p.price,
            }))
          ),
          status: values.status,
        };

      await window.api.editSalesOrder(editingSalesOrder.id, updatedOrder);

      await fetchData();

      setIsEditModalVisible(false);
      setEditingSalesOrder(null);

      message.success("Sales Order updated successfully.");
    } catch (error) {
      console.error("Failed to edit sales order:", error);
      message.error("Failed to edit sales order.");
    }
  };

  // --- Delete ---
  const handleDeleteSalesOrder = async (id: number) => {
    Modal.confirm({
      title: "Are you sure you want to delete this sales order?",
      content: "This action cannot be undone.",
      okText: "Yes, Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await window.api.deleteSalesOrder(id);
          await fetchData();

          message.success("Sales Order deleted successfully.");
        } catch (error) {
          console.error("Failed to delete sales order:", error);
          message.error("Failed to delete sales order.");
        }
      },
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedSalesOrderKeys.length === 0) {
      message.warning("Please select sales orders to delete.");
      return;
    }

    Modal.confirm({
      title: "Are you sure you want to delete the selected sales orders?",
      content: "This action cannot be undone.",
      okText: "Yes, Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          const idsToDelete = selectedSalesOrderKeys.map((key) => {
            const order = salesOrders.find((o) => o.id === key);
            return order?.id;
          });

          if (idsToDelete.every((id): id is number => typeof id === "number")) {
            await Promise.all(
              idsToDelete.map((id) => window.api.deleteSalesOrder(id))
            );
            await fetchData();

            message.success("Selected sales orders deleted successfully.");
          }
        } catch (error) {
          console.error("Failed to delete selected sales orders:", error);
          message.error("Failed to delete selected sales orders.");
        }
      },
    });
  };

  // --- Export CSV ---
  const handleExportCSV = () => {
    const csvData = [
      [
        "Order ID",
        "Customer",
        "Order Date",
        "Products",
        "Status",
        "Total Amount",
      ],
      ...filteredSalesOrders.map((order) => {
        const customerName = getCustomerName(order.customerId);
        const orderDate = moment(order.orderDate).format("YYYY-MM-DD");
        const productList = order.products
          .map(
            (p) =>
              `${getProductName(p.product_id)} (Qty: ${p.quantity}, Price: ${
                p.price
              })`
          )
          .join(", ");
        const totalAmount = order.totalAmount;
        const status = order.status;

        return [
          order.id,
          customerName,
          orderDate,
          productList,
          status,
          totalAmount,
        ];
      }),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales_orders.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // --- Table Row Selection ---
  const onSelectChange = (selectedRowKeys: React.Key[]) => {
    setSelectedSalesOrderKeys(selectedRowKeys);
  };

  const rowSelection = {
    selectedSalesOrderKeys,
    onChange: onSelectChange,
  };

  // --- Table Columns ---
  const columns: ColumnType<ISalesOrder>[] = [
    {
      title: "Order ID",
      dataIndex: "id",
      key: "id",
      onHeaderCell: () => ({
        style: { position: "sticky", top: 0, zIndex: 1, background: "#fff" },
      }),
    },
    {
      title: "Customer",
      dataIndex: "customerId",
      key: "customerId",
      render: (customerId) => getCustomerName(customerId),
      onHeaderCell: () => ({
        style: { position: "sticky", top: 0, zIndex: 1, background: "#fff" },
      }),
    },
    {
      title: "Order Date",
      dataIndex: "orderDate",
      key: "orderDate",
      render: (date) => moment(date).format("YYYY-MM-DD"),
      onHeaderCell: () => ({
        style: { position: "sticky", top: 0, zIndex: 1, background: "#fff" },
      }),
    },
    {
      title: "Products",
      dataIndex: "products",
      key: "products",
      render: (products: ISalesOrderProduct[]) => (
        <div>
          {products.map((product) => (
            <div key={product.product_id}>
              {getProductName(product.product_id)} (Qty: {product.quantity},
              Price: {product.price?.toLocaleString("en-PK")})
            </div>
          ))}
        </div>
      ),
      onHeaderCell: () => ({
        style: { position: "sticky", top: 0, zIndex: 1, background: "#fff" },
      }),
    },
    {
      title: "Total Amount",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (amount) => amount?.toLocaleString("en-PK"),
      onHeaderCell: () => ({
        style: { position: "sticky", top: 0, zIndex: 1, background: "#fff" },
      }),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      onHeaderCell: () => ({
        style: { position: "sticky", top: 0, zIndex: 1, background: "#fff" },
      }),
      render: (status) => {
        let color = "";
        switch (status) {
          case "pending":
            color = "yellow";
            break;
          case "shipped":
            color = "blue";
            break;
          case "delivered":
            color = "green";
            break;
          case "cancelled":
            color = "red";
            break;
          default:
            color = "gray";
        }
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Action",
      key: "action",
      width: 180,
      render: (_: unknown, record: ISalesOrder) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            size="small"
            onClick={() => showEditModal(record)}
            icon={<EditOutlined />}
          >
            Edit
          </Button>
          <Button
            size="small"
            onClick={() => handleDeleteSalesOrder(record.id)}
            danger
            icon={<DeleteOutlined />}
          >
            Delete
          </Button>
        </div>
      ),
      onHeaderCell: () => ({
        style: { position: "sticky", top: 0, zIndex: 1, background: "#fff" },
      }),
    },
  ];

  const getProductSellingPrice = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    return product?.sellingPrice;
  };

  const getProductStockQuantity = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    const editingProduct = editingSalesOrder?.products?.find(
      (p) => p.product_id === productId
    );

    return (
      (product?.stockQuantity || 0) +
      (editingSalesOrder?.status === "cancelled"
        ? 0
        : editingProduct?.quantity || 0)
    );
  };

  // --- Add/Edit Form ---
  const salesOrderForm = (
    formInstance: FormInstance,
    availableCustomers: ICustomer[],
    availableProducts: IProduct[]
  ) => [
    //Added formInstance
    {
      name: "customerId",
      label: "Customer",
      rules: [{ required: true, message: "Please select a customer!" }],
      children: (
        <Select>
          {availableCustomers.map((customer) => (
            <Option key={customer.id} value={customer.id}>
              {customer.name}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      name: "orderDate",
      label: "Order Date",
      rules: [{ required: true, message: "Please select order date!" }],
      children: <DatePicker style={{ width: "100%" }} />,
    },
    {
      name: "status",
      label: "Status",
      rules: [{ required: true, message: "Please select status!" }],
      children: (
        <Select>
          <Option value="pending">Pending</Option>
          <Option value="shipped">Shipped</Option>
          <Option value="delivered">Delivered</Option>
          <Option value="cancelled">Cancelled</Option>
        </Select>
      ),
    },
    {
      name: "products",
      label: "Products",
      rules: [{ required: true, message: "Please select products!" }],
      children: (
        <Form.List name="products">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <div
                  key={field.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <Form.Item
                    {...field}
                    name={[field.name, "product_id"]}
                    label={index === 0 ? "Product" : ""}
                    rules={[
                      { required: true, message: "Please select product" },
                    ]}
                    style={{ flex: 2 }}
                  >
                    <Select
                      showSearch // Enable search
                      filterOption={(input, option: any) => {
                        const label =
                          typeof option.children === "string"
                            ? option.children
                            : Array.isArray(option.children)
                            ? option.children.join("")
                            : "";
                        return (
                          label.toLowerCase().indexOf(input.toLowerCase()) >= 0
                        );
                      }}
                      onChange={(productId) => {
                        const sellingPrice = getProductSellingPrice(productId);
                        formInstance.setFieldsValue({
                          //changed from form to formInstance
                          products: formInstance //changed from form to formInstance
                            ?.getFieldValue("products")
                            ?.map((item: any, i: number) =>
                              i === index
                                ? { ...item, price: sellingPrice }
                                : item
                            ),
                        });
                      }}
                    >
                      {availableProducts.map((product) => (
                        <Option key={product.id} value={product.id}>
                          {product.name} (Stock:{" "}
                          {product.stockQuantity +
                            (editingSalesOrder?.status === "cancelled"
                              ? 0
                              : editingSalesOrder?.products?.find(
                                  (p) => p.product_id === product.id
                                )?.quantity || 0)}
                          )
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    {...field}
                    name={[field.name, "quantity"]}
                    label={index === 0 ? "Quantity" : ""}
                    rules={[
                      { required: true, message: "Please enter quantity" },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || value < 1) {
                            return Promise.reject(
                              new Error("Quantity must be at least 1")
                            );
                          }

                          const product_id = getFieldValue([
                            "products",
                            field.key,
                            "product_id",
                          ]);

                          const stockQuantity =
                            getProductStockQuantity(product_id);
                          if (
                            stockQuantity !== undefined &&
                            value > stockQuantity
                          ) {
                            return Promise.reject(
                              new Error(
                                `Quantity exceeds available stock (${stockQuantity})`
                              )
                            );
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                    style={{ flex: 1 }}
                  >
                    <InputNumber min={1} />
                  </Form.Item>
                  <Form.Item
                    {...field}
                    name={[field.name, "price"]}
                    label={index === 0 ? "Price" : ""}
                    style={{ flex: 1 }}
                  >
                    <InputNumber disabled />
                  </Form.Item>
                  {fields.length > 1 ? (
                    <Button
                      type="dashed"
                      onClick={() => remove(field.name)}
                      icon={<DeleteOutlined />}
                      style={index !== 0 ? { marginBottom: 24 } : {}}
                    />
                  ) : null}
                </div>
              ))}
              <Button
                type="dashed"
                onClick={() => add()}
                style={{ width: "100%" }}
                icon={<PlusOutlined />}
              >
                Add Product
              </Button>
            </>
          )}
        </Form.List>
      ),
    },
  ];

  return (
    <div>
      <Header style={{ background: "#fff", padding: "0 24px" }}>
        <h1 style={{ margin: 0 }}>Sales Orders</h1>
      </Header>

      <Content style={{ padding: "24px" }}>
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Input
            placeholder="Search Sales Orders"
            prefix={<SearchOutlined />}
            style={{ maxWidth: "300px", flexGrow: 1 }}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <div style={{ display: "flex", gap: "16px" }}>
            <Button
              danger
              onClick={handleDeleteSelected}
              disabled={selectedSalesOrderKeys.length === 0}
              icon={<DeleteOutlined />}
            >
              Delete Selected
            </Button>
            <Button onClick={handleExportCSV} icon={<FileExcelOutlined />}>
              Export CSV
            </Button>
            <Button
              onClick={showAddModal}
              type="primary"
              icon={<PlusOutlined />}
            >
              <TagOutlined />
              Add Order
            </Button>
          </div>
        </div>

        <Table
          rowSelection={rowSelection}
          dataSource={loading ? [] : filteredSalesOrders}
          pagination={{ pageSize: 9 }}
          loading={loading}
          rowKey="id"
          columns={columns as ColumnType<ISalesOrder>[]}
        />
      </Content>

      <Modal
        title="Add Sales Order"
        okText="Save Order"
        open={isAddModalVisible}
        onOk={handleAddOk}
        onCancel={handleAddCancel}
      >
        <Form form={form} layout="vertical">
          {salesOrderForm(form, customers, products).map(
            (
              item // Pass the form instance
            ) => (
              <Form.Item key={item.name} {...item}>
                {item.children}
              </Form.Item>
            )
          )}
        </Form>
      </Modal>

      <Modal
        title="Edit Sales Order"
        okText="Update Order"
        open={isEditModalVisible}
        onOk={handleEditOk}
        onCancel={handleEditCancel}
      >
        <Form form={editForm} layout="vertical">
          {salesOrderForm(editForm, customers, products).map(
            (
              item // Pass the editForm instance
            ) => (
              <Form.Item key={item.name} {...item}>
                {item.children}
              </Form.Item>
            )
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default SalesOrderPage;
