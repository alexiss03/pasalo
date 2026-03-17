declare module "pg" {
  const pg: {
    Pool: new (config?: { connectionString?: string }) => {
      query: (...args: any[]) => Promise<any>;
      connect: (...args: any[]) => Promise<any>;
      end: () => Promise<void>;
    };
  };

  export default pg;
}
