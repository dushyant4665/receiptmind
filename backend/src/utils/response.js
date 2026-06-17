/*
  =====================================
  SUCCESS RESPONSE
  =====================================
*/

const successResponse = (
  data = {},
  message = 'Success'
) => {

  return {

    success: true,

    message,

    data,
  };
};

/*
  =====================================
  ERROR RESPONSE
  =====================================
*/

const errorResponse = (
  error = 'Something went wrong'
) => {

  /*
    ================================
    STRING ERROR
    ================================
  */

  if (
    typeof error === 'string'
  ) {

    return {

      success: false,

      error: {
        message: error,
      },
    };
  }

  /*
    ================================
    OBJECT ERROR
    ================================
  */

  return {

    success: false,

    error,
  };
};

/*
  =====================================
  PAGINATION RESPONSE
  =====================================
*/

const paginatedResponse = (

  items = [],

  page = 1,

  limit = 20,

  total = 0
) => {

  const totalPages =
    Math.ceil(total / limit);

  return {

    success: true,

    data: items,

    pagination: {

      page,

      limit,

      total,

      total_pages:
        totalPages,

      has_next:
        page < totalPages,

      has_previous:
        page > 1,
    },
  };
};

module.exports = {

  successResponse,

  errorResponse,

  paginatedResponse,
};