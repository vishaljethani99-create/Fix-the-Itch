export const metadata = {
  title: 'Sanket - SignBridge',
  description: 'Two-way communication bridge for signers and counter staff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'sans-serif' }}>
        {children}
      </body>
    </html>
  );
}