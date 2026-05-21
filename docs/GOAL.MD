## I. Mục tiêu và yêu cầu chung
Bài tập lớn yêu cầu sinh viên xây dựng một hệ thống xử lý dữ liệu lớn hoàn chỉnh, vận dụng kiến thức đã học để giải quyết bài toán thực tế. Sinh viên phải triển khai một trong hai mô hình kiến trúc: Kiến trúc Lambda hoặc Kiến trúc Kappa, tập trung xây dựng pipeline dữ liệu end-to-end (thu thập → xử lý → lưu trữ → trực quan hóa).

Yêu cầu kỹ thuật
Thành phần	Công nghệ
Xử lý dữ liệu	Apache Spark (PySpark hoặc Scala)
Lưu trữ phân tán	HDFS hoặc tương đương
Hàng đợi tin nhắn	Apache Kafka, RabbitMQ, v.v.
Cơ sở dữ liệu	NoSQL
Triển khai	Kubernetes hoặc Cloud (không khuyến khích chỉ dùng Docker)
Yêu cầu xử lý dữ liệu với Spark
Sinh viên cần thể hiện kỹ năng Spark mức trung cấp qua các phép biến đổi và hành động đa dạng. Nếu dùng framework tương đương thay Spark, cần giải thích kiến trúc và so sánh ưu/nhược điểm với Spark.

1. Tổng hợp phức tạp
Hàm cửa sổ và hàm tổng hợp nâng cao
Thao tác pivot và unpivot
Hàm tổng hợp tùy biến
2. Biến đổi nâng cao
Nhiều giai đoạn biến đổi
Chuỗi thao tác phức tạp
UDF tùy biến cho logic nghiệp vụ
3. Thao tác Join
Broadcast join (tập dữ liệu không cân bằng)
Sort-merge join (dữ liệu quy mô lớn)
Tối ưu nhiều join
4. Tối ưu hiệu năng
Partition pruning và bucketing
Chiến lược cache và persistence
Tối ưu truy vấn và kế hoạch thực thi
5. Xử lý luồng (Streaming)
Structured Streaming, các chế độ output
Watermarking và xử lý dữ liệu đến trễ
Quản lý state; đảm bảo exactly-once
6. Phân tích nâng cao
Học máy (Spark MLlib)
Đồ thị (GraphFrames)
Thống kê, chuỗi thời gian
II. Yêu cầu báo cáo
1. Định nghĩa bài toán
Bài toán lựa chọn
Phân tích mức độ phù hợp với dữ liệu lớn
Phạm vi và giới hạn dự án
2. Kiến trúc và thiết kế
Kiến trúc tổng thể (Lambda/Kappa)
Các thành phần và vai trò
Sơ đồ luồng dữ liệu và tương tác giữa các thành phần
3. Chi tiết triển khai
Mã nguồn kèm tài liệu
File cấu hình theo môi trường
Chiến lược triển khai và thiết lập giám sát
4. Bài học kinh nghiệm (Lessons Learned)
Với mỗi bài học, báo cáo theo mẫu:

### Bài học X: [Tiêu đề]

#### Mô tả vấn đề
- Bối cảnh và nền tảng
- Thách thức gặp phải
- Tác động đến hệ thống

#### Cách tiếp cận đã thử
- Cách 1 / Cách 2 / ...
- Đánh đổi của từng cách

#### Giải pháp cuối cùng
- Giải pháp chi tiết, triển khai, chỉ số và kết quả

#### Điểm rút ra
- Hiểu biết kỹ thuật, thực hành tốt, đề xuất
Các nhóm bài học cần có:

Thu thập dữ liệu — Nhiều nguồn đa dạng; chất lượng dữ liệu; dữ liệu đến trễ; trùng lặp và phiên bản
Xử lý dữ liệu với Spark — Tối ưu job; quản lý bộ nhớ; partition; tối ưu theo chi phí
Xử lý luồng — Exactly-once; cửa sổ; state; phục hồi
Lưu trữ dữ liệu — Định dạng lưu trữ; phân vùng; nén; dữ liệu nóng/lạnh
Tích hợp hệ thống — Service discovery; xử lý lỗi; circuit breaker; cân bằng tải
Tối ưu hiệu năng — Cache; truy vấn; phân bổ tài nguyên; điểm nghẽn
Giám sát & gỡ lỗi — Metrics; cảnh báo; log; phân tích nguyên nhân gốc
Mở rộng (Scaling) — Ngang/dọc; auto-scaling; kế hoạch tài nguyên; chi phí
Chất lượng dữ liệu & kiểm thử — Kiểm tra dữ liệu; unit/integration/performance testing
Bảo mật & quản trị — Truy cập; mã hóa; audit log; tuân thủ
Chịu lỗi — Phục hồi; nhân bản; backup; khôi phục thảm họa