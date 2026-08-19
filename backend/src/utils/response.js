const successResponse = (data = {}, message = 'Success') => ({
  success: true,
  message,
  data,
});

const errorResponse = (error = 'Something went wrong') => ({
  success: false,
  error: typeof error === 'string' ? { message: error } : error,
});

const paginatedResponse = (items = [], page = 1, limit = 20, total = 0) => {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_previous: page > 1,
    },
  };
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};